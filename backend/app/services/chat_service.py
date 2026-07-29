"""Chat orchestration: load history → call LLM → persist turns."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.core.config import Settings
from app.providers.llm.base import LLMClient
from app.providers.store.base import ChatStore
from app.schema import ChatMessage, ChatRequest, ChatResponse, SessionHistoryResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)


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

    async def chat(self, request: ChatRequest) -> ChatResponse:
        session_id = request.session_id or str(uuid.uuid4())
        history = await self._store.get_messages(
            session_id,
            limit=self._settings.chat_history_limit,
        )

        user_message = ChatMessage(
            role="user",
            content=request.message,
            created_at=datetime.now(UTC),
        )
        prompt_messages = [*history, user_message]

        logger.info(
            "Generating reply session_id=%s history_len=%s",
            session_id,
            len(history),
        )
        reply_text = await self._llm.generate(prompt_messages)

        assistant_message = ChatMessage(
            role="assistant",
            content=reply_text,
            created_at=datetime.now(UTC),
        )
        await self._store.append_messages(session_id, [user_message, assistant_message])

        return ChatResponse(session_id=session_id, reply=reply_text)

    async def get_history(self, session_id: str) -> SessionHistoryResponse:
        messages = await self._store.get_messages(
            session_id,
            limit=self._settings.chat_history_limit,
        )
        return SessionHistoryResponse(session_id=session_id, messages=messages)
