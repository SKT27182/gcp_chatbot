"""Factory for LLM clients based on settings."""

from __future__ import annotations

from app.core.config import Settings
from app.providers.llm.base import LLMClient
from app.providers.llm.litellm_client import LiteLLMClient
from app.utils.logger import get_logger

logger = get_logger(__name__)


def create_llm_client(settings: Settings) -> LLMClient:
    logger.info("Using LiteLLMClient model=%s", settings.litellm_model)
    return LiteLLMClient(settings)
