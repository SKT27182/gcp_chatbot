"""Sanitize and generate session titles."""

from __future__ import annotations

import re

from app.providers.llm.base import LLMClient
from app.providers.store.base import ChatStore
from app.schema import ChatMessage
from app.utils.logger import get_logger

logger = get_logger(__name__)

TITLE_SYSTEM = (
    "You generate short chat session titles. "
    "Reply with a concise title only — no quotes, no trailing punctuation, "
    "max 8 words."
)

_TITLE_MAX_LEN = 60
_WHITESPACE_RE = re.compile(r"\s+")


def sanitize_title(raw: str, *, max_len: int = _TITLE_MAX_LEN) -> str:
    """Normalize an LLM title to a single-line sidebar-safe string."""
    cleaned = _WHITESPACE_RE.sub(" ", (raw or "").strip())
    cleaned = cleaned.strip(" \"'`")
    # Drop surrounding markdown bold/italics if the model adds them.
    cleaned = cleaned.strip("*_")
    if not cleaned:
        return "New chat"
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 1].rstrip() + "…"


class TitleGenerator:
    """Load early conversation context and ask the LLM for a title."""

    def __init__(self, *, llm: LLMClient, store: ChatStore) -> None:
        self._llm = llm
        self._store = store

    async def generate(
        self,
        *,
        user_id: str,
        session_id: str,
        history_limit: int = 6,
    ) -> str:
        messages = await self._store.get_messages(
            session_id,
            limit=history_limit,
            user_id=user_id,
        )
        if not messages:
            return "New chat"

        prompt_messages: list[ChatMessage] = [
            *messages,
            ChatMessage(
                role="user",
                content=(
                    "Write a short title that summarizes this conversation "
                    "for a chat sidebar."
                ),
            ),
        ]
        raw = await self._llm.generate(
            prompt_messages,
            system_instruction=TITLE_SYSTEM,
        )
        title = sanitize_title(raw)
        logger.info(
            "Generated title session_id=%s user_id=%s title=%r",
            session_id,
            user_id,
            title,
        )
        return title
