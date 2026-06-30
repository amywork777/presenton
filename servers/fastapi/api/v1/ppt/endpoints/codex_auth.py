"""
OpenAI Codex OAuth endpoints.

Flow:
  1. POST /codex/auth/initiate — request a ChatGPT device code.
  2. User opens the verification URL and enters the code.
  3. GET /codex/auth/status/{session_id} polls OpenAI and stores tokens on success.
  4. POST /codex/auth/refresh forces token refresh from the auth store.
"""
from __future__ import annotations

import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.oauth.openai_codex import (
    CodexAccountProfile,
    CodexAuthError,
    DevicePollPending,
    TokenFailure,
    TokenSuccess,
    clear_codex_auth,
    exchange_authorization_code,
    poll_device_authorization,
    request_device_authorization,
    resolve_codex_runtime_credentials,
    save_codex_tokens,
)


CODEX_AUTH_ROUTER = APIRouter(prefix="/codex/auth", tags=["Codex OAuth"])

_sessions: dict[str, dict] = {}


class InitiateResponse(BaseModel):
    session_id: str
    verification_url: str
    user_code: str
    expires_at: int
    interval: int
    instructions: str


class StatusResponse(BaseModel):
    status: str
    account_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    is_pro: Optional[bool] = None
    verification_url: Optional[str] = None
    user_code: Optional[str] = None
    expires_at: Optional[int] = None
    interval: Optional[int] = None
    detail: Optional[str] = None


class ExchangeRequest(BaseModel):
    session_id: str
    code: str
    code_verifier: Optional[str] = None


class ExchangeResponse(BaseModel):
    account_id: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    is_pro: Optional[bool] = None


class RefreshResponse(BaseModel):
    account_id: Optional[str]
    username: Optional[str] = None
    email: Optional[str] = None
    is_pro: Optional[bool] = None
    detail: str


def _profile_response(profile: CodexAccountProfile, status: str = "success") -> StatusResponse:
    return StatusResponse(
        status=status,
        account_id=profile.account_id,
        username=profile.username,
        email=profile.email,
        is_pro=profile.is_pro,
    )


def _exchange_response(profile: CodexAccountProfile) -> ExchangeResponse:
    return ExchangeResponse(
        account_id=profile.account_id,
        username=profile.username,
        email=profile.email,
        is_pro=profile.is_pro,
    )


def _session_pending_response(session: dict) -> StatusResponse:
    return StatusResponse(
        status="pending",
        verification_url=session.get("verification_url"),
        user_code=session.get("user_code"),
        expires_at=session.get("expires_at"),
        interval=session.get("interval"),
    )


def _failure(status_code: int, result: TokenFailure) -> HTTPException:
    return HTTPException(status_code=status_code, detail=result.reason)


@CODEX_AUTH_ROUTER.post("/initiate", response_model=InitiateResponse)
async def initiate_codex_auth():
    auth = request_device_authorization()
    if isinstance(auth, TokenFailure):
        raise _failure(auth.status_code, auth)

    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "device_auth_id": auth.device_auth_id,
        "user_code": auth.user_code,
        "verification_url": auth.verification_url,
        "expires_at": auth.expires_at,
        "interval": auth.interval,
        "next_poll_at": 0.0,
    }

    return InitiateResponse(
        session_id=session_id,
        verification_url=auth.verification_url,
        user_code=auth.user_code,
        expires_at=auth.expires_at,
        interval=auth.interval,
        instructions=(
            "Open the verification URL, enter the code, and keep this page open "
            "while Presenton completes sign-in."
        ),
    )


@CODEX_AUTH_ROUTER.get("/status/{session_id}", response_model=StatusResponse)
async def poll_codex_auth_status(session_id: str):
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already consumed")

    now_ms = int(time.time() * 1000)
    if now_ms >= int(session.get("expires_at") or 0):
        _sessions.pop(session_id, None)
        return StatusResponse(status="failed", detail="ChatGPT sign-in code expired. Please start again.")

    now = time.monotonic()
    next_poll_at = float(session.get("next_poll_at") or 0.0)
    if now < next_poll_at:
        return _session_pending_response(session)

    result = poll_device_authorization(
        str(session["device_auth_id"]),
        str(session["user_code"]),
    )

    if isinstance(result, DevicePollPending):
        interval = max(int(session.get("interval") or result.interval or 5), result.interval)
        session["interval"] = interval
        session["next_poll_at"] = time.monotonic() + interval
        return _session_pending_response(session)

    _sessions.pop(session_id, None)
    if isinstance(result, TokenFailure):
        return StatusResponse(status="failed", detail=result.reason)

    token_result = exchange_authorization_code(result.authorization_code, result.code_verifier)
    if not isinstance(token_result, TokenSuccess):
        return StatusResponse(status="failed", detail=token_result.reason)

    profile = save_codex_tokens(token_result)
    return _profile_response(profile, status="success")


@CODEX_AUTH_ROUTER.post("/exchange", response_model=ExchangeResponse)
async def exchange_codex_code(body: ExchangeRequest):
    """
    Advanced fallback for already-completed device auth.

    The normal UI uses /status polling. This endpoint accepts an authorization
    code plus code_verifier if a caller has captured them out-of-band.
    """
    session = _sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or already consumed")
    if not body.code_verifier:
        raise HTTPException(
            status_code=400,
            detail="Manual exchange requires both authorization code and code_verifier.",
        )

    result = exchange_authorization_code(body.code.strip(), body.code_verifier.strip())
    _sessions.pop(body.session_id, None)
    if not isinstance(result, TokenSuccess):
        raise _failure(result.status_code, result)

    profile = save_codex_tokens(result)
    return _exchange_response(profile)


@CODEX_AUTH_ROUTER.post("/refresh", response_model=RefreshResponse)
async def refresh_codex_token():
    try:
        creds = resolve_codex_runtime_credentials(force_refresh=True)
    except CodexAuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return RefreshResponse(
        account_id=creds.get("account_id"),
        username=creds.get("username"),
        email=creds.get("email"),
        is_pro=creds.get("is_pro") if isinstance(creds.get("is_pro"), bool) else None,
        detail="Token refreshed successfully",
    )


@CODEX_AUTH_ROUTER.get("/status", response_model=StatusResponse)
async def get_codex_auth_status():
    try:
        creds = resolve_codex_runtime_credentials(refresh_if_expiring=True)
    except CodexAuthError as exc:
        if exc.relogin_required:
            return StatusResponse(status="not_authenticated", detail=str(exc))
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return StatusResponse(
        status="authenticated",
        account_id=creds.get("account_id"),
        username=creds.get("username"),
        email=creds.get("email"),
        is_pro=creds.get("is_pro") if isinstance(creds.get("is_pro"), bool) else None,
    )


@CODEX_AUTH_ROUTER.post("/logout")
async def logout_codex():
    clear_codex_auth()
    return {"detail": "Logged out successfully"}
