"""LLM client protocol — cloud-agnostic interface."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.schema import ChatMessage


@runtime_checkable
class LLMClient(Protocol):
    """Generate assistant replies from conversation history."""

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
    ) -> str:
        """Return assistant text for the given message history."""
        ...
