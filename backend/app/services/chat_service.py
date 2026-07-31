"""Chat orchestration: load history → call LLM → persist turns."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from app.core.config import Settings
from app.providers.llm.base import LLMClient
from app.providers.store.base import ChatStore
from app.schema import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    SessionHistoryResponse,
    SessionListResponse,
    SessionSummary,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


class ChatService:
    def __init__(
        self,
        *,
        llm: LLMClient,
        store: ChatStore,
        settings: Settings,
    ) -> None:
        self._llm = llm
        self._store = store
        self._settings = settings

    async def chat(self, request: ChatRequest, *, user_id: str | None = None) -> ChatResponse:
        session_id = request.session_id or str(uuid.uuid4())
        history = await self._store.get_messages(
            session_id,
            limit=self._settings.chat_history_limit,
            user_id=user_id,
        )

        user_message = ChatMessage(
            role="user",
            content=request.message,
            created_at=datetime.now(UTC),
        )
        prompt_messages = [*history, user_message]

        logger.info(
            "Generating reply session_id=%s history_len=%s user_id=%s",
            session_id,
            len(history),
            user_id,
        )
        reply_text = await self._llm.generate(prompt_messages)

        assistant_message = ChatMessage(
            role="assistant",
            content=reply_text,
            created_at=datetime.now(UTC),
        )
        await self._store.append_messages(
            session_id,
            [user_message, assistant_message],
            user_id=user_id,
        )

        return ChatResponse(session_id=session_id, reply=reply_text)

    async def chat_stream(
        self,
        request: ChatRequest,
        *,
        user_id: str | None = None,
    ) -> AsyncIterator[str]:
        """Yield SSE `data:` lines: session, token*, done | error."""
        session_id = request.session_id or str(uuid.uuid4())
        yield _sse({"type": "session", "session_id": session_id})

        try:
            history = await self._store.get_messages(
                session_id,
                limit=self._settings.chat_history_limit,
                user_id=user_id,
            )
            user_message = ChatMessage(
                role="user",
                content=request.message,
                created_at=datetime.now(UTC),
            )
            prompt_messages = [*history, user_message]

            logger.info(
                "Streaming reply session_id=%s history_len=%s user_id=%s",
                session_id,
                len(history),
                user_id,
            )

            chunks: list[str] = []
            async for token in self._llm.generate_stream(prompt_messages):
                chunks.append(token)
                yield _sse({"type": "token", "content": token})

            reply_text = "".join(chunks).strip()
            if not reply_text:
                raise RuntimeError("LLM returned an empty streamed response")

            assistant_message = ChatMessage(
                role="assistant",
                content=reply_text,
                created_at=datetime.now(UTC),
            )
            await self._store.append_messages(
                session_id,
                [user_message, assistant_message],
                user_id=user_id,
            )
            yield _sse({"type": "done", "session_id": session_id})
        except Exception as exc:
            logger.exception("Chat stream failed session_id=%s", session_id)
            yield _sse({"type": "error", "detail": str(exc) or "Failed to stream chat reply"})

    async def get_history(
        self,
        session_id: str,
        *,
        user_id: str | None = None,
    ) -> SessionHistoryResponse:
        messages = await self._store.get_messages(
            session_id,
            limit=self._settings.chat_history_limit,
            user_id=user_id,
        )
        return SessionHistoryResponse(session_id=session_id, messages=messages)

    async def list_sessions(
        self,
        *,
        limit: int = 50,
        user_id: str | None = None,
    ) -> SessionListResponse:
        sessions: list[SessionSummary] = await self._store.list_sessions(
            limit=limit,
            user_id=user_id,
        )
        return SessionListResponse(sessions=sessions)

    async def delete_session(
        self,
        session_id: str,
        *,
        user_id: str | None = None,
    ) -> bool:
        deleted = await self._store.delete_session(session_id, user_id=user_id)
        if deleted:
            logger.info("Deleted chat session_id=%s user_id=%s", session_id, user_id)
        return deleted
