"""Chat store protocol — cloud-agnostic interface."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.schema import ChatMessage, SessionSummary


@runtime_checkable
class ChatStore(Protocol):
    """Persist and load conversation messages by session id (optionally user-scoped)."""

    async def get_messages(
        self,
        session_id: str,
        *,
        limit: int,
        user_id: str | None = None,
    ) -> list[ChatMessage]:
        """Return the most recent messages for a session (oldest → newest)."""
        ...

    async def append_messages(
        self,
        session_id: str,
        messages: list[ChatMessage],
        *,
        user_id: str | None = None,
    ) -> None:
        """Append messages to a session (creates session if missing)."""
        ...

    async def list_sessions(
        self,
        *,
        limit: int = 50,
        user_id: str | None = None,
    ) -> list[SessionSummary]:
        """Return recent sessions (newest first) for the sidebar."""
        ...

    async def delete_session(
        self,
        session_id: str,
        *,
        user_id: str | None = None,
    ) -> bool:
        """Delete a session and its messages. Return False if missing."""
        ...
