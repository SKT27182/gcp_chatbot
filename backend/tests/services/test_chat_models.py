"""Vertex chat model catalog and LiteLLM per-call kwargs."""

from __future__ import annotations

import pytest

from app.core.config import Settings
from app.providers.llm.litellm_client import LiteLLMClient
from app.providers.llm.models import (
    DEFAULT_CHAT_MODEL,
    UnknownChatModelError,
    default_chat_model,
    resolve_chat_model,
)


def test_resolve_omitted_uses_allowlisted_env_default() -> None:
    assert (
        resolve_chat_model(None, default_model="vertex_ai/gemini-2.5-pro")
        == "vertex_ai/gemini-2.5-pro"
    )


def test_resolve_omitted_falls_back_when_env_not_allowlisted() -> None:
    assert (
        resolve_chat_model("", default_model="gemini/gemini-2.0-flash")
        == DEFAULT_CHAT_MODEL
    )
    assert default_chat_model("openai/gpt-4o") == DEFAULT_CHAT_MODEL


def test_resolve_unknown_model_raises() -> None:
    with pytest.raises(UnknownChatModelError, match="openai/gpt-4o"):
        resolve_chat_model("openai/gpt-4o", default_model=DEFAULT_CHAT_MODEL)


def test_litellm_uses_catalog_location_for_partner_model() -> None:
    client = LiteLLMClient(
        Settings(
            litellm_model="vertex_ai/gemini-3.5-flash-lite",
            gcp_project_id="proj-1",
            gcp_location="global",
            environment="test",
        )
    )
    kwargs = client._completion_kwargs(
        messages=[{"role": "user", "content": "hi"}],
        model="vertex_ai/openai/gpt-oss-20b-maas",
        stream=False,
    )
    assert kwargs["model"] == "vertex_ai/openai/gpt-oss-20b-maas"
    assert kwargs["vertex_project"] == "proj-1"
    assert kwargs["vertex_location"] == "us-central1"
    assert kwargs["vertex_ai_location"] == "us-central1"
    assert kwargs["labels"]["service"] == "llm"


def test_litellm_gemini_37_uses_global() -> None:
    client = LiteLLMClient(
        Settings(
            litellm_model="vertex_ai/gemini-3.5-flash-lite",
            gcp_project_id="proj-1",
            gcp_location="us-central1",
            environment="test",
        )
    )
    kwargs = client._completion_kwargs(
        messages=[{"role": "user", "content": "hi"}],
        model="vertex_ai/gemini-3.7-flash",
        stream=True,
    )
    assert kwargs["vertex_location"] == "global"
    assert kwargs["vertex_ai_location"] == "global"


def test_litellm_title_path_keeps_configured_model() -> None:
    client = LiteLLMClient(
        Settings(
            litellm_model="vertex_ai/gemini-3.5-flash-lite",
            gcp_project_id="proj-1",
            gcp_location="global",
            environment="test",
        )
    )
    kwargs = client._completion_kwargs(
        messages=[{"role": "user", "content": "hi"}],
        model=None,
        stream=True,
    )
    assert kwargs["model"] == "vertex_ai/gemini-3.5-flash-lite"
    assert kwargs["vertex_location"] == "global"
    assert kwargs["stream"] is True


def test_vertexai_sdk_is_installed() -> None:
    """Partner Vertex models import `vertexai` from google-cloud-aiplatform."""
    import vertexai

    assert vertexai is not None
