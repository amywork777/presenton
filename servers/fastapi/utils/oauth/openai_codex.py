"""
OpenAI Codex (ChatGPT OAuth) helpers.

Presenton keeps ChatGPT/Codex credentials in an app-scoped auth store, not in
userConfig.json. The login flow mirrors Hermes' top-level provider flow: request
a device code, poll OpenAI until the browser sign-in completes, exchange the
authorization code, then resolve/refresh credentials centrally at runtime.
"""
from __future__ import annotations

import base64
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from utils.codex_auth_store import (
    clear_codex_provider_state,
    get_codex_provider_state,
    save_codex_provider_state,
    utc_now_iso,
)
from utils.get_env import get_user_config_path_env
from utils.parsers import parse_bool_or_none
from utils.user_config_store import read_user_config_file, update_user_config_file


CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
ISSUER = "https://auth.openai.com"
DEVICE_USER_CODE_URL = f"{ISSUER}/api/accounts/deviceauth/usercode"
DEVICE_TOKEN_URL = f"{ISSUER}/api/accounts/deviceauth/token"
DEVICE_VERIFICATION_URL = f"{ISSUER}/codex/device"
DEVICE_REDIRECT_URI = f"{ISSUER}/deviceauth/callback"
TOKEN_URL = f"{ISSUER}/oauth/token"
CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
JWT_CLAIM_PATH = "https://api.openai.com/auth"
ACCESS_TOKEN_REFRESH_SKEW_SECONDS = 120
AUTH_MODE = "chatgpt"

LEGACY_CODEX_CONFIG_FIELDS = (
    "CODEX_ACCESS_TOKEN",
    "CODEX_REFRESH_TOKEN",
    "CODEX_TOKEN_EXPIRES",
    "CODEX_ACCOUNT_ID",
    "CODEX_USERNAME",
    "CODEX_EMAIL",
    "CODEX_IS_PRO",
)


class CodexAuthError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "codex_auth_error",
        relogin_required: bool = False,
        status_code: int = 400,
    ):
        super().__init__(message)
        self.code = code
        self.relogin_required = relogin_required
        self.status_code = status_code


@dataclass
class TokenSuccess:
    access: str
    refresh: str
    expires: Optional[int] = None
    id_token: Optional[str] = None


@dataclass
class TokenFailure:
    reason: str
    code: str = "token_error"
    relogin_required: bool = False
    status_code: int = 502


TokenResult = TokenSuccess | TokenFailure


@dataclass
class DeviceAuthorization:
    device_auth_id: str
    user_code: str
    verification_url: str
    interval: int
    expires_at: int


@dataclass
class DevicePollPending:
    interval: int


@dataclass
class DevicePollSuccess:
    authorization_code: str
    code_verifier: str


DevicePollResult = DevicePollPending | DevicePollSuccess | TokenFailure


@dataclass
class CodexAccountProfile:
    account_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    is_pro: Optional[bool] = None


def _decode_jwt_payload(token: str) -> Optional[dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        decoded = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(decoded)
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def _jwt_expiry_ms(token: str) -> Optional[int]:
    payload = _decode_jwt_payload(token)
    if not payload:
        return None
    exp = payload.get("exp")
    if isinstance(exp, (int, float)):
        return int(exp * 1000)
    return None


def access_token_is_expiring(token: str, skew_seconds: int = ACCESS_TOKEN_REFRESH_SKEW_SECONDS) -> bool:
    expires_ms = _jwt_expiry_ms(token)
    if expires_ms is None:
        return False
    now_ms = int(time.time() * 1000)
    return now_ms >= expires_ms - (skew_seconds * 1000)


def get_account_id(access_token: str) -> Optional[str]:
    payload = _decode_jwt_payload(access_token)
    if not payload:
        return None
    auth_claims = payload.get(JWT_CLAIM_PATH)
    if not isinstance(auth_claims, dict):
        return None
    account_id = auth_claims.get("chatgpt_account_id")
    return account_id if isinstance(account_id, str) and account_id else None


def _as_non_empty_str(value: Any) -> Optional[str]:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def get_account_profile(access_token: str, id_token: Optional[str] = None) -> CodexAccountProfile:
    access_payload = _decode_jwt_payload(access_token) or {}
    access_auth = access_payload.get(JWT_CLAIM_PATH)
    access_auth = access_auth if isinstance(access_auth, dict) else {}

    access_profile = access_payload.get("https://api.openai.com/profile")
    access_profile = access_profile if isinstance(access_profile, dict) else {}

    id_payload = _decode_jwt_payload(id_token) if id_token else None
    id_payload = id_payload if isinstance(id_payload, dict) else {}
    id_auth = id_payload.get(JWT_CLAIM_PATH)
    id_auth = id_auth if isinstance(id_auth, dict) else {}

    account_id = _as_non_empty_str(access_auth.get("chatgpt_account_id")) or _as_non_empty_str(
        id_auth.get("chatgpt_account_id")
    )
    username = _as_non_empty_str(id_payload.get("name"))
    email = _as_non_empty_str(access_profile.get("email")) or _as_non_empty_str(
        id_payload.get("email")
    )

    plan_type = _as_non_empty_str(access_auth.get("chatgpt_plan_type")) or _as_non_empty_str(
        id_auth.get("chatgpt_plan_type")
    )
    is_pro = plan_type.strip().lower() != "free" if plan_type else None

    return CodexAccountProfile(
        account_id=account_id,
        username=username,
        email=email,
        is_pro=is_pro,
    )


def _token_expires_ms(access_token: str, expires_in: Any = None) -> Optional[int]:
    if isinstance(expires_in, (int, float)):
        return int(time.time() * 1000) + int(expires_in) * 1000
    return _jwt_expiry_ms(access_token)


def request_device_authorization() -> DeviceAuthorization | TokenFailure:
    try:
        with httpx.Client(timeout=httpx.Timeout(15.0)) as client:
            response = client.post(
                DEVICE_USER_CODE_URL,
                json={"client_id": CLIENT_ID},
                headers={"Content-Type": "application/json"},
            )
    except Exception as exc:
        return TokenFailure(reason=f"Failed to request device code: {exc}", code="device_code_request_failed")

    if response.status_code == 429:
        return TokenFailure(
            reason="OpenAI is rate-limiting ChatGPT sign-in requests. Please wait a minute and try again.",
            code="rate_limited",
            status_code=429,
        )
    if response.status_code != 200:
        return TokenFailure(
            reason=f"Device code request returned status {response.status_code}.",
            code="device_code_request_error",
        )

    body = response.json()
    device_auth_id = body.get("device_auth_id")
    user_code = body.get("user_code")
    interval = body.get("interval", 5)
    expires_in = body.get("expires_in", 900)

    if not isinstance(device_auth_id, str) or not device_auth_id:
        return TokenFailure(reason="Device code response missing device_auth_id.", code="device_code_incomplete")
    if not isinstance(user_code, str) or not user_code:
        return TokenFailure(reason="Device code response missing user_code.", code="device_code_incomplete")

    try:
        interval_int = max(3, int(interval))
    except (TypeError, ValueError):
        interval_int = 5
    try:
        expires_in_int = max(60, int(expires_in))
    except (TypeError, ValueError):
        expires_in_int = 900

    return DeviceAuthorization(
        device_auth_id=device_auth_id,
        user_code=user_code,
        verification_url=DEVICE_VERIFICATION_URL,
        interval=interval_int,
        expires_at=int(time.time() * 1000) + expires_in_int * 1000,
    )


def poll_device_authorization(device_auth_id: str, user_code: str) -> DevicePollResult:
    try:
        with httpx.Client(timeout=httpx.Timeout(15.0)) as client:
            response = client.post(
                DEVICE_TOKEN_URL,
                json={"device_auth_id": device_auth_id, "user_code": user_code},
                headers={"Content-Type": "application/json"},
            )
    except Exception as exc:
        return TokenFailure(reason=f"Device auth polling failed: {exc}", code="device_code_poll_failed")

    if response.status_code == 200:
        body = response.json()
        authorization_code = body.get("authorization_code")
        code_verifier = body.get("code_verifier")
        if not isinstance(authorization_code, str) or not isinstance(code_verifier, str):
            return TokenFailure(
                reason="Device auth response missing authorization_code or code_verifier.",
                code="device_code_incomplete_exchange",
            )
        return DevicePollSuccess(
            authorization_code=authorization_code,
            code_verifier=code_verifier,
        )
    if response.status_code in {403, 404}:
        return DevicePollPending(interval=5)
    if response.status_code == 429:
        return TokenFailure(
            reason="OpenAI is rate-limiting ChatGPT sign-in polling. Please wait and try again.",
            code="rate_limited",
            status_code=429,
        )
    return TokenFailure(
        reason=f"Device auth polling returned status {response.status_code}.",
        code="device_code_poll_error",
    )


def exchange_authorization_code(
    code: str,
    verifier: str,
    redirect_uri: str = DEVICE_REDIRECT_URI,
) -> TokenResult:
    try:
        with httpx.Client(timeout=httpx.Timeout(30.0)) as client:
            response = client.post(
                TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "authorization_code",
                    "client_id": CLIENT_ID,
                    "code": code,
                    "code_verifier": verifier,
                    "redirect_uri": redirect_uri,
                },
            )
    except Exception as exc:
        return TokenFailure(reason=str(exc), code="token_exchange_failed")

    if response.status_code == 429:
        return TokenFailure(
            reason="OpenAI is rate-limiting ChatGPT token exchange. Please wait and try again.",
            code="rate_limited",
            status_code=429,
        )
    if not response.is_success:
        return TokenFailure(
            reason=f"HTTP {response.status_code}: {response.text[:200]}",
            code="token_exchange_error",
        )

    body = response.json()
    access = body.get("access_token")
    refresh = body.get("refresh_token")

    if not isinstance(access, str) or not access:
        return TokenFailure(reason="Token response missing access_token.", code="token_exchange_missing_access_token")
    if not isinstance(refresh, str) or not refresh:
        return TokenFailure(reason="Token response missing refresh_token.", code="token_exchange_missing_refresh_token")

    id_token = body.get("id_token")
    return TokenSuccess(
        access=access,
        refresh=refresh,
        expires=_token_expires_ms(access, body.get("expires_in")),
        id_token=id_token if isinstance(id_token, str) else None,
    )


def refresh_access_token(refresh_token: str) -> TokenResult:
    try:
        with httpx.Client(timeout=httpx.Timeout(30.0)) as client:
            response = client.post(
                TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": CLIENT_ID,
                },
            )
    except Exception as exc:
        return TokenFailure(reason=str(exc), code="token_refresh_failed")

    if response.status_code == 429:
        return TokenFailure(
            reason="OpenAI is rate-limiting ChatGPT token refresh. Credentials are still valid; retry later.",
            code="rate_limited",
            relogin_required=False,
            status_code=429,
        )
    if not response.is_success:
        relogin_required = response.status_code in {400, 401, 403}
        return TokenFailure(
            reason=f"HTTP {response.status_code}: {response.text[:200]}",
            code="token_refresh_error",
            relogin_required=relogin_required,
            status_code=response.status_code,
        )

    body = response.json()
    access = body.get("access_token")
    next_refresh = body.get("refresh_token") or refresh_token

    if not isinstance(access, str) or not access:
        return TokenFailure(
            reason="Token refresh response missing access_token.",
            code="token_refresh_missing_access_token",
            relogin_required=True,
        )
    if not isinstance(next_refresh, str) or not next_refresh:
        return TokenFailure(
            reason="Token refresh response missing refresh_token.",
            code="token_refresh_missing_refresh_token",
            relogin_required=True,
        )

    return TokenSuccess(
        access=access,
        refresh=next_refresh,
        expires=_token_expires_ms(access, body.get("expires_in")),
    )


def _state_from_token_result(result: TokenSuccess) -> dict[str, Any]:
    profile = get_account_profile(result.access, result.id_token)
    return {
        "auth_mode": AUTH_MODE,
        "base_url": CODEX_BASE_URL,
        "tokens": {
            "access_token": result.access,
            "refresh_token": result.refresh,
        },
        "expires_at": result.expires,
        "last_refresh": utc_now_iso(),
        "account_id": profile.account_id,
        "username": profile.username,
        "email": profile.email,
        "is_pro": profile.is_pro,
    }


def save_codex_tokens(result: TokenSuccess) -> CodexAccountProfile:
    state = _state_from_token_result(result)
    save_codex_provider_state(state)
    _clear_legacy_codex_user_config_fields()
    return CodexAccountProfile(
        account_id=state.get("account_id"),
        username=state.get("username"),
        email=state.get("email"),
        is_pro=state.get("is_pro") if isinstance(state.get("is_pro"), bool) else None,
    )


def clear_codex_auth() -> None:
    clear_codex_provider_state()
    _clear_legacy_codex_user_config_fields()
    for key in LEGACY_CODEX_CONFIG_FIELDS:
        os.environ.pop(key, None)


def _state_profile(state: dict[str, Any]) -> CodexAccountProfile:
    tokens = state.get("tokens")
    access_token = tokens.get("access_token") if isinstance(tokens, dict) else None
    parsed = get_account_profile(access_token) if isinstance(access_token, str) else CodexAccountProfile()
    return CodexAccountProfile(
        account_id=parsed.account_id or _as_non_empty_str(state.get("account_id")),
        username=parsed.username or _as_non_empty_str(state.get("username")),
        email=parsed.email or _as_non_empty_str(state.get("email")),
        is_pro=parsed.is_pro if parsed.is_pro is not None else (
            state.get("is_pro") if isinstance(state.get("is_pro"), bool) else None
        ),
    )


def get_stored_codex_profile() -> CodexAccountProfile | None:
    state = _load_codex_state_with_legacy_migration()
    if not state:
        return None
    return _state_profile(state)


def _clear_legacy_codex_user_config_fields() -> None:
    user_config_path = (get_user_config_path_env() or "").strip()
    if not user_config_path:
        return

    def _update(existing: dict[str, Any]) -> dict[str, Any]:
        for key in LEGACY_CODEX_CONFIG_FIELDS:
            existing.pop(key, None)
        return existing

    try:
        update_user_config_file(user_config_path, _update)
    except Exception as exc:
        print(f"[Presenton] Failed to clear legacy Codex credentials from user config: {exc}")


def _legacy_state_from_user_config() -> dict[str, Any] | None:
    user_config_path = (get_user_config_path_env() or "").strip()
    if not user_config_path:
        return None
    config = read_user_config_file(user_config_path)
    access_token = config.get("CODEX_ACCESS_TOKEN")
    refresh_token = config.get("CODEX_REFRESH_TOKEN")
    if not isinstance(access_token, str) or not access_token.strip():
        return None
    if not isinstance(refresh_token, str) or not refresh_token.strip():
        return None

    expires_at = config.get("CODEX_TOKEN_EXPIRES")
    try:
        expires_at_value = int(expires_at) if expires_at not in (None, "") else _jwt_expiry_ms(access_token)
    except (TypeError, ValueError):
        expires_at_value = _jwt_expiry_ms(access_token)

    profile = get_account_profile(access_token)
    return {
        "auth_mode": AUTH_MODE,
        "base_url": CODEX_BASE_URL,
        "tokens": {
            "access_token": access_token.strip(),
            "refresh_token": refresh_token.strip(),
        },
        "expires_at": expires_at_value,
        "last_refresh": utc_now_iso(),
        "account_id": profile.account_id or _as_non_empty_str(config.get("CODEX_ACCOUNT_ID")),
        "username": profile.username or _as_non_empty_str(config.get("CODEX_USERNAME")),
        "email": profile.email or _as_non_empty_str(config.get("CODEX_EMAIL")),
        "is_pro": profile.is_pro if profile.is_pro is not None else parse_bool_or_none(config.get("CODEX_IS_PRO")),
    }


def _load_codex_state_with_legacy_migration() -> dict[str, Any] | None:
    state = get_codex_provider_state()
    if isinstance(state, dict):
        return state

    legacy_state = _legacy_state_from_user_config()
    if not legacy_state:
        return None

    save_codex_provider_state(legacy_state)
    _clear_legacy_codex_user_config_fields()
    return legacy_state


def _valid_token_state(state: dict[str, Any] | None) -> tuple[str, str]:
    if not isinstance(state, dict):
        raise CodexAuthError(
            "No ChatGPT credentials stored. Sign in with ChatGPT first.",
            code="codex_auth_missing",
            relogin_required=True,
        )

    tokens = state.get("tokens")
    if not isinstance(tokens, dict):
        raise CodexAuthError(
            "ChatGPT auth state is invalid. Sign in again.",
            code="codex_auth_invalid_shape",
            relogin_required=True,
        )

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    if not isinstance(access_token, str) or not access_token.strip():
        raise CodexAuthError(
            "ChatGPT auth is missing an access token. Sign in again.",
            code="codex_auth_missing_access_token",
            relogin_required=True,
        )
    if not isinstance(refresh_token, str) or not refresh_token.strip():
        raise CodexAuthError(
            "ChatGPT auth is missing a refresh token. Sign in again.",
            code="codex_auth_missing_refresh_token",
            relogin_required=True,
        )
    return access_token.strip(), refresh_token.strip()


def _state_token_expiring(state: dict[str, Any], access_token: str, skew_seconds: int) -> bool:
    if access_token_is_expiring(access_token, skew_seconds):
        return True
    expires_at = state.get("expires_at")
    if isinstance(expires_at, (int, float)):
        return int(time.time() * 1000) >= int(expires_at) - (skew_seconds * 1000)
    return False


def resolve_codex_runtime_credentials(
    *,
    force_refresh: bool = False,
    refresh_if_expiring: bool = True,
    refresh_skew_seconds: int = ACCESS_TOKEN_REFRESH_SKEW_SECONDS,
) -> dict[str, Any]:
    state = _load_codex_state_with_legacy_migration()
    access_token, _refresh_token = _valid_token_state(state)
    should_refresh = force_refresh or (
        refresh_if_expiring and _state_token_expiring(state or {}, access_token, refresh_skew_seconds)
    )

    if should_refresh:
        _, refresh_token = _valid_token_state(state)
        result = refresh_access_token(refresh_token)
        if not isinstance(result, TokenSuccess):
            raise CodexAuthError(
                result.reason,
                code=result.code,
                relogin_required=result.relogin_required,
                status_code=result.status_code,
            )
        save_codex_tokens(result)
        state = get_codex_provider_state()
        access_token, _refresh_token = _valid_token_state(state)

    profile = _state_profile(state or {})
    return {
        "provider": "codex",
        "base_url": CODEX_BASE_URL,
        "access_token": access_token,
        "api_key": access_token,
        "account_id": profile.account_id,
        "username": profile.username,
        "email": profile.email,
        "is_pro": profile.is_pro,
        "auth_mode": AUTH_MODE,
        "source": "presenton-auth-store",
    }
