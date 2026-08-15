"""Curated Vertex AI chat models — ADC only, no provider API keys."""

from __future__ import annotations

from dataclasses import dataclass

DEFAULT_CHAT_MODEL = "vertex_ai/gemini-3.5-flash-lite"


@dataclass(frozen=True)
class VertexModel:
    """One selectable Vertex publisher model."""

    id: str
    family: str
    label: str
    location: str


VERTEX_MODELS: tuple[VertexModel, ...] = (
    VertexModel("vertex_ai/gemini-3.7-flash", "Gemini", "Gemini 3.7 Flash", "global"),
    VertexModel("vertex_ai/gemini-3.6-flash", "Gemini", "Gemini 3.6 Flash", "global"),
    VertexModel("vertex_ai/gemini-3.5-flash", "Gemini", "Gemini 3.5 Flash", "global"),
    VertexModel(DEFAULT_CHAT_MODEL, "Gemini", "Gemini 3.5 Flash-Lite", "global"),
    VertexModel("vertex_ai/gemini-2.5-flash", "Gemini", "Gemini 2.5 Flash", "global"),
    VertexModel("vertex_ai/gemini-2.5-pro", "Gemini", "Gemini 2.5 Pro", "global"),
    VertexModel(
        "vertex_ai/openai/gpt-oss-20b-maas",
        "OpenAI",
        "GPT-OSS 20B",
        "us-central1",
    ),
    VertexModel(
        "vertex_ai/openai/gpt-oss-120b-maas",
        "OpenAI",
        "GPT-OSS 120B",
        "us-central1",
    ),
    VertexModel(
        "vertex_ai/meta/llama-3.3-70b-instruct-maas",
        "Llama",
        "Llama 3.3 70B",
        "us-central1",
    ),
    VertexModel(
        "vertex_ai/deepseek-ai/deepseek-v3.2-maas",
        "DeepSeek",
        "DeepSeek V3.2",
        "global",
    ),
    VertexModel(
        "vertex_ai/qwen/qwen3-next-80b-a3b-instruct-maas",
        "Qwen",
        "Qwen3-Next 80B",
        "global",
    ),
    VertexModel(
        "vertex_ai/qwen/qwen3-235b-a22b-instruct-2507-maas",
        "Qwen",
        "Qwen3 235B",
        "global",
    ),
    VertexModel(
        "vertex_ai/qwen/qwen3-coder-480b-a35b-instruct-maas",
        "Qwen",
        "Qwen3 Coder 480B",
        "global",
    ),
    VertexModel(
        "vertex_ai/google/gemma-4-26b-a4b-it-maas",
        "Gemma",
        "Gemma 4 26B",
        "global",
    ),
)

_BY_ID: dict[str, VertexModel] = {model.id: model for model in VERTEX_MODELS}


class UnknownChatModelError(ValueError):
    """Raised when a chat request asks for a model outside the Vertex allowlist."""

    def __init__(self, model: str) -> None:
        super().__init__(f"Unknown or disallowed model: {model}")
        self.model = model


def get_vertex_model(model_id: str) -> VertexModel | None:
    return _BY_ID.get(model_id)


def list_vertex_models() -> list[VertexModel]:
    return list(VERTEX_MODELS)


def default_chat_model(configured: str) -> str:
    """Fallback for omitted request model: env default if allowlisted, else Flash-Lite."""
    if configured in _BY_ID:
        return configured
    return DEFAULT_CHAT_MODEL


def resolve_chat_model(requested: str | None, *, default_model: str) -> str:
    """Return an allowlisted Vertex model id, or raise UnknownChatModelError."""
    if requested is None or not requested.strip():
        return default_chat_model(default_model)
    cleaned = requested.strip()
    if cleaned not in _BY_ID:
        raise UnknownChatModelError(cleaned)
    return cleaned
