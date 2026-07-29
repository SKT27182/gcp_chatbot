"""Chat store protocol — cloud-agnostic interface."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.schema import ChatMessage, SessionSummary


@runtime_checkable
class ChatStore(Protocol):
    """Persist and load conversation messages by session id."""

    async def get_messages(self, session_id: str, *, limit: int) -> list[ChatMessage]:
        """Return the most recent messages for a session (oldest → newest)."""
        ...

    async def append_messages(self, session_id: str, messages: list[ChatMessage]) -> None:
        """Append messages to a session (creates session if missing)."""
        ...

    async def list_sessions(self, *, limit: int = 50) -> list[SessionSummary]:
        """Return recent sessions (newest first) for the sidebar."""
        ...
