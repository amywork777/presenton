from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Callable

from utils.get_env import get_app_data_directory_env, get_user_config_path_env
from utils.user_config_store import read_user_config_file, update_user_config_file


AUTH_STORE_VERSION = 1
CODEX_PROVIDER_ID = "codex"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_codex_auth_store_path() -> str:
    user_config_path = (get_user_config_path_env() or "").strip()
    if user_config_path:
        return os.path.join(os.path.dirname(user_config_path), "auth.json")

    app_data_dir = (get_app_data_directory_env() or "").strip()
    if app_data_dir:
        return os.path.join(app_data_dir, "auth.json")

    return os.path.join(os.getcwd(), "app_data", "auth.json")


def _normalize_store(store: dict[str, Any]) -> dict[str, Any]:
    providers = store.get("providers")
    if not isinstance(providers, dict):
        providers = {}
    return {
        "version": AUTH_STORE_VERSION,
        "providers": providers,
    }


def read_auth_store() -> dict[str, Any]:
    return _normalize_store(read_user_config_file(get_codex_auth_store_path()))


def update_auth_store(update: Callable[[dict[str, Any]], dict[str, Any]]) -> dict[str, Any]:
    def _update(existing: dict[str, Any]) -> dict[str, Any]:
        normalized = _normalize_store(existing)
        next_store = update(normalized)
        return _normalize_store(next_store)

    return update_user_config_file(get_codex_auth_store_path(), _update)


def get_codex_provider_state() -> dict[str, Any] | None:
    providers = read_auth_store().get("providers")
    if not isinstance(providers, dict):
        return None
    state = providers.get(CODEX_PROVIDER_ID)
    return state if isinstance(state, dict) else None


def save_codex_provider_state(state: dict[str, Any]) -> None:
    def _update(store: dict[str, Any]) -> dict[str, Any]:
        providers = store.setdefault("providers", {})
        providers[CODEX_PROVIDER_ID] = dict(state)
        return store

    update_auth_store(_update)


def clear_codex_provider_state() -> None:
    def _update(store: dict[str, Any]) -> dict[str, Any]:
        providers = store.setdefault("providers", {})
        providers.pop(CODEX_PROVIDER_ID, None)
        return store

    update_auth_store(_update)
