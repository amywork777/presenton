import asyncio
import base64
import json
import time
from pathlib import Path

import pytest

from api.v1.ppt.endpoints import codex_auth
from utils.codex_auth_store import (
    clear_codex_provider_state,
    get_codex_auth_store_path,
    get_codex_provider_state,
    save_codex_provider_state,
)
from utils.oauth import openai_codex
from utils.user_config_store import read_user_config_file


def _configure_auth_paths(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    user_config_path = tmp_path / "userConfig.json"
    monkeypatch.setenv("USER_CONFIG_PATH", str(user_config_path))
    monkeypatch.delenv("APP_DATA_DIRECTORY", raising=False)
    return user_config_path


def _jwt(payload: dict) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).rstrip(b"=")
    return f"header.{encoded.decode('ascii')}.signature"


def _access_token(account_id: str = "acc_test", *, expires_in_seconds: int = 3600) -> str:
    return _jwt(
        {
            "exp": int(time.time()) + expires_in_seconds,
            "https://api.openai.com/auth": {
                "chatgpt_account_id": account_id,
                "chatgpt_plan_type": "plus",
            },
            "https://api.openai.com/profile": {
                "email": f"{account_id}@example.com",
            },
        }
    )


def test_codex_auth_store_uses_user_config_sibling(monkeypatch, tmp_path):
    _configure_auth_paths(monkeypatch, tmp_path)

    assert Path(get_codex_auth_store_path()) == tmp_path / "auth.json"

    save_codex_provider_state({"tokens": {"access_token": "access", "refresh_token": "refresh"}})
    assert get_codex_provider_state() == {
        "tokens": {"access_token": "access", "refresh_token": "refresh"}
    }

    clear_codex_provider_state()
    assert get_codex_provider_state() is None


def test_resolve_migrates_legacy_user_config_tokens(monkeypatch, tmp_path):
    user_config_path = _configure_auth_paths(monkeypatch, tmp_path)
    access_token = _access_token("acc_legacy")
    user_config_path.write_text(
        json.dumps(
            {
                "LLM": "codex",
                "CODEX_MODEL": "gpt-5.2-high",
                "CODEX_ACCESS_TOKEN": access_token,
                "CODEX_REFRESH_TOKEN": "legacy-refresh",
                "CODEX_TOKEN_EXPIRES": str(int(time.time() * 1000) + 3600_000),
                "CODEX_USERNAME": "legacy-user",
            }
        ),
        encoding="utf-8",
    )

    creds = openai_codex.resolve_codex_runtime_credentials(refresh_if_expiring=False)

    assert creds["access_token"] == access_token
    assert creds["account_id"] == "acc_legacy"
    assert creds["email"] == "acc_legacy@example.com"
    assert get_codex_provider_state()["tokens"] == {
        "access_token": access_token,
        "refresh_token": "legacy-refresh",
    }

    migrated_config = read_user_config_file(str(user_config_path))
    assert migrated_config["LLM"] == "codex"
    assert migrated_config["CODEX_MODEL"] == "gpt-5.2-high"
    assert "CODEX_ACCESS_TOKEN" not in migrated_config
    assert "CODEX_REFRESH_TOKEN" not in migrated_config
    assert "CODEX_USERNAME" not in migrated_config


def test_resolve_refreshes_expired_auth_store_token(monkeypatch, tmp_path):
    _configure_auth_paths(monkeypatch, tmp_path)
    old_access = _access_token("acc_old", expires_in_seconds=-60)
    new_access = _access_token("acc_new")
    save_codex_provider_state(
        {
            "auth_mode": "chatgpt",
            "tokens": {
                "access_token": old_access,
                "refresh_token": "old-refresh",
            },
            "expires_at": int(time.time() * 1000) - 1000,
        }
    )

    def fake_refresh(refresh_token: str):
        assert refresh_token == "old-refresh"
        return openai_codex.TokenSuccess(
            access=new_access,
            refresh="new-refresh",
            expires=int(time.time() * 1000) + 3600_000,
        )

    monkeypatch.setattr(openai_codex, "refresh_access_token", fake_refresh)

    creds = openai_codex.resolve_codex_runtime_credentials()

    assert creds["access_token"] == new_access
    assert creds["account_id"] == "acc_new"
    assert get_codex_provider_state()["tokens"] == {
        "access_token": new_access,
        "refresh_token": "new-refresh",
    }


def test_resolve_requires_stored_codex_credentials(monkeypatch, tmp_path):
    _configure_auth_paths(monkeypatch, tmp_path)

    with pytest.raises(openai_codex.CodexAuthError) as exc_info:
        openai_codex.resolve_codex_runtime_credentials(refresh_if_expiring=False)

    assert exc_info.value.relogin_required is True
    assert exc_info.value.code == "codex_auth_missing"


def test_device_poll_endpoint_exchanges_and_saves_tokens(monkeypatch, tmp_path):
    _configure_auth_paths(monkeypatch, tmp_path)
    codex_auth._sessions.clear()
    expires_at = int(time.time() * 1000) + 900_000

    monkeypatch.setattr(
        codex_auth,
        "request_device_authorization",
        lambda: openai_codex.DeviceAuthorization(
            device_auth_id="device-auth-id",
            user_code="ABCD-EFGH",
            verification_url="https://auth.openai.com/codex/device",
            interval=3,
            expires_at=expires_at,
        ),
    )
    monkeypatch.setattr(
        codex_auth,
        "poll_device_authorization",
        lambda device_auth_id, user_code: openai_codex.DevicePollSuccess(
            authorization_code=f"code-for-{device_auth_id}-{user_code}",
            code_verifier="verifier",
        ),
    )

    def fake_exchange(code: str, verifier: str):
        assert code == "code-for-device-auth-id-ABCD-EFGH"
        assert verifier == "verifier"
        return openai_codex.TokenSuccess(
            access=_access_token("acc_endpoint"),
            refresh="endpoint-refresh",
            expires=int(time.time() * 1000) + 3600_000,
        )

    monkeypatch.setattr(codex_auth, "exchange_authorization_code", fake_exchange)

    initiate = asyncio.run(codex_auth.initiate_codex_auth())
    assert initiate.user_code == "ABCD-EFGH"
    assert initiate.verification_url == "https://auth.openai.com/codex/device"

    status = asyncio.run(codex_auth.poll_codex_auth_status(initiate.session_id))

    assert status.status == "success"
    assert status.account_id == "acc_endpoint"
    assert status.email == "acc_endpoint@example.com"
    assert initiate.session_id not in codex_auth._sessions
    assert get_codex_provider_state()["tokens"]["refresh_token"] == "endpoint-refresh"
