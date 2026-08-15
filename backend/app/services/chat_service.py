"""Chat orchestration: load history → call LLM → persist turns."""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from app.core.config import Settings
from app.providers.llm.base import LLMClient
from app.providers.llm.models import resolve_chat_model
from app.providers.store.base import ChatStore
from app.schema import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    SessionHistoryResponse,
    SessionListResponse,
    SessionSummary,
)
from app.services.title_job_service import TitleJobService
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
        title_jobs: TitleJobService | None = None,
    ) -> None:
        self._llm = llm
        self._store = store
        self._settings = settings
        self._title_jobs = title_jobs

    async def _maybe_enqueue_title(
        self,
        *,
        session_id: str,
        user_id: str | None,
        is_first_assistant: bool,
    ) -> None:
        if not is_first_assistant or not user_id or self._title_jobs is None:
            return
        if not self._settings.jobs_enabled:
            return
        await self._title_jobs.enqueue_generate_title(
            user_id=user_id,
            session_id=session_id,
        )

    async def chat(self, request: ChatRequest, *, user_id: str | None = None) -> ChatResponse:
        model = resolve_chat_model(
            request.model,
            default_model=self._settings.litellm_model,
        )
        session_id = request.session_id or str(uuid.uuid4())
        history = await self._store.get_messages(
            session_id,
            limit=self._settings.chat_history_limit,
            user_id=user_id,
        )
        is_first_assistant = not any(m.role == "assistant" for m in history)

        user_message = ChatMessage(
            role="user",
            content=request.message,
            created_at=datetime.now(UTC),
        )
        # Persist the user turn immediately so a failed LLM call does not lose it.
        await self._store.append_messages(session_id, [user_message], user_id=user_id)
        prompt_messages = [*history, user_message]

        logger.info(
            "Generating reply session_id=%s history_len=%s user_id=%s model=%s",
            session_id,
            len(history),
            user_id,
            model,
        )
        reply_text = await self._llm.generate(prompt_messages, model=model)

        assistant_message = ChatMessage(
            role="assistant",
            content=reply_text,
            created_at=datetime.now(UTC),
        )
        await self._store.append_messages(session_id, [assistant_message], user_id=user_id)
        await self._maybe_enqueue_title(
            session_id=session_id,
            user_id=user_id,
            is_first_assistant=is_first_assistant,
        )

        return ChatResponse(session_id=session_id, reply=reply_text)

    async def chat_stream(
        self,
        request: ChatRequest,
        *,
        user_id: str | None = None,
    ) -> AsyncIterator[str]:
        """Yield SSE `data:` lines: session, token*, done | error.

        User message is written to the store before generation. Assistant is
        written only after a successful stream. Errors are never persisted.
        """
        model = resolve_chat_model(
            request.model,
            default_model=self._settings.litellm_model,
        )
        session_id = request.session_id or str(uuid.uuid4())
        yield _sse({"type": "session", "session_id": session_id})

        try:
            history = await self._store.get_messages(
                session_id,
                limit=self._settings.chat_history_limit,
                user_id=user_id,
            )
            is_first_assistant = not any(m.role == "assistant" for m in history)
            user_message = ChatMessage(
                role="user",
                content=request.message,
                created_at=datetime.now(UTC),
            )
            # Persist user turn first so Stop / disconnect / LLM failure keep the query.
            await self._store.append_messages(session_id, [user_message], user_id=user_id)
            prompt_messages = [*history, user_message]

            logger.info(
                "Streaming reply session_id=%s history_len=%s user_id=%s model=%s",
                session_id,
                len(history),
                user_id,
                model,
            )

            chunks: list[str] = []
            async for token in self._llm.generate_stream(prompt_messages, model=model):
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
            await self._store.append_messages(session_id, [assistant_message], user_id=user_id)
            await self._maybe_enqueue_title(
                session_id=session_id,
                user_id=user_id,
                is_first_assistant=is_first_assistant,
            )
            yield _sse({"type": "done", "session_id": session_id})
        except Exception as exc:
            logger.exception("Chat stream failed session_id=%s", session_id)
            # UI-only error: do not append assistant/error text to Firestore.
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
