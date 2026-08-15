"""LiteLLM chat client — Gemini/Vertex/Azure/Bedrock via one SDK."""

from __future__ import annotations

import os
from typing import Any

from litellm import acompletion

from app.core.config import Settings
from app.providers.llm.models import get_vertex_model
from app.schema import ChatMessage
from app.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_SYSTEM = (
    "You are a helpful assistant. Answer clearly and concisely. "
    "Use prior conversation turns for follow-up context."
)


class LiteLLMClient:
    """LLMClient backed by LiteLLM.

    API-key path (AI Studio / OpenAI-compatible, etc.):
      LITELLM_MODEL=gemini/gemini-3.5-flash-lite
      LITELLM_API_KEY=...
      # optional: LITELLM_BASE_URL=...

    Vertex ADC / service-account path (no API key in .env):
      LITELLM_MODEL=vertex_ai/gemini-3.5-flash-lite
      GCP_LOCATION=global
      GCP_PROJECT_ID=...
      GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json  # local; Cloud Run uses runtime SA
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.litellm_model:
            raise ValueError("LITELLM_MODEL is required")

        self._settings = settings
        self._model = settings.litellm_model
        self._extra: dict[str, Any] = {}
        self._billing_labels: dict[str, str] | None = None

        api_key = settings.litellm_api_key.strip()
        base_url = settings.litellm_base_url.strip()

        if self._model.startswith("vertex_ai/"):
            # Auth = ADC / Cloud Run SA — do not require LITELLM_API_KEY
            if not settings.gcp_project_id:
                raise ValueError("GCP_PROJECT_ID is required for vertex_ai/* models")
            self._extra["vertex_project"] = settings.gcp_project_id
            self._extra["vertex_location"] = settings.gcp_location
            if settings.google_application_credentials:
                creds = settings.google_application_credentials
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds
                self._extra["vertex_credentials"] = creds
            self._billing_labels = settings.billing_labels
        elif self._model.startswith("gemini/"):
            if not api_key:
                raise ValueError(
                    "LITELLM_API_KEY is required for gemini/* models "
                    "(Google AI Studio key)."
                )
            self._extra["api_key"] = api_key
            # LiteLLM also reads GEMINI_API_KEY for this provider prefix
            os.environ.setdefault("GEMINI_API_KEY", api_key)
            os.environ.setdefault("LITELLM_API_KEY", api_key)
            if base_url:
                self._extra["api_base"] = base_url
        else:
            # openai/*, azure/*, etc.
            if api_key:
                self._extra["api_key"] = api_key
                os.environ.setdefault("LITELLM_API_KEY", api_key)
            if base_url:
                self._extra["api_base"] = base_url

        if settings.gcp_project_id:
            self._billing_labels = settings.billing_labels

        logger.info("Initialized LiteLLMClient model=%s", self._model)

    def _vertex_kwargs(self, location: str) -> dict[str, Any]:
        if not self._settings.gcp_project_id:
            raise ValueError("GCP_PROJECT_ID is required for vertex_ai/* models")
        extra: dict[str, Any] = {
            "vertex_project": self._settings.gcp_project_id,
            # LiteLLM pops either name; Model Garden defaults a missing location
            # to us-central1 even when GCP_LOCATION=global.
            "vertex_location": location,
            "vertex_ai_location": location,
        }
        creds = self._settings.google_application_credentials
        if creds:
            extra["vertex_credentials"] = creds
        return extra

    def _completion_kwargs(
        self,
        *,
        messages: list[dict[str, str]],
        model: str | None,
        stream: bool,
    ) -> dict[str, Any]:
        resolved = model or self._model
        catalog = get_vertex_model(resolved)
        kwargs: dict[str, Any] = {"model": resolved, "messages": messages}
        if catalog is not None:
            kwargs.update(self._vertex_kwargs(catalog.location))
            if self._billing_labels:
                kwargs["labels"] = self._billing_labels
        else:
            kwargs.update(self._extra)
            if self._billing_labels:
                kwargs["labels"] = self._billing_labels
        if stream:
            kwargs["stream"] = True
        return kwargs

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
        model: str | None = None,
    ) -> str:
        payload = self._build_payload(messages, system_instruction=system_instruction)
        kwargs = self._completion_kwargs(messages=payload, model=model, stream=False)

        response = await acompletion(**kwargs)
        text = response.choices[0].message.content
        if not text:
            raise RuntimeError("LiteLLM returned an empty response")
        return text.strip()

    async def generate_stream(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
        model: str | None = None,
    ):
        payload = self._build_payload(messages, system_instruction=system_instruction)
        kwargs = self._completion_kwargs(messages=payload, model=model, stream=True)

        stream = await acompletion(**kwargs)
        async for chunk in stream:
            choices = getattr(chunk, "choices", None) or []
            if not choices:
                continue
            delta = getattr(choices[0], "delta", None)
            content = getattr(delta, "content", None) if delta is not None else None
            if content:
                yield content

    def _build_payload(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
    ) -> list[dict[str, str]]:
        payload: list[dict[str, str]] = [
            {"role": "system", "content": system_instruction or DEFAULT_SYSTEM}
        ]
        for message in messages:
            if message.role == "system":
                continue
            role = "assistant" if message.role == "assistant" else "user"
            payload.append({"role": role, "content": message.content})

        if not any(item["role"] == "user" for item in payload):
            raise ValueError("Cannot generate a reply with an empty message list")
        return payload
