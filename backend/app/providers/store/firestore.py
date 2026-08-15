"""Firestore chat history adapter."""

from __future__ import annotations

from datetime import UTC, datetime

from google.cloud import firestore

from app.core.config import Settings
from app.schema import ChatMessage, SessionSummary
from app.utils.logger import get_logger

logger = get_logger(__name__)


class SessionNotFoundError(Exception):
    """Raised when a session is missing or not owned by the caller."""


def _truncate(text: str, max_len: int) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 1].rstrip() + "…"


class FirestoreChatStore:
    """ChatStore backed by Firestore Native mode.

    Phase 2 layout (when user_id is set):
      users/{user_id}/sessions/{session_id}  — {title, preview, updated_at, created_at}
        messages/{message_id}               — {role, content, created_at}

    Legacy Phase 1 layout (user_id is None — tests / pre-auth only):
      sessions/{session_id}
        messages/{auto_id}
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.gcp_project_id:
            raise ValueError("GCP_PROJECT_ID is required for Firestore")

        kwargs: dict[str, str] = {"project": settings.gcp_project_id}
        if settings.firestore_database and settings.firestore_database != "(default)":
            kwargs["database"] = settings.firestore_database

        self._client = firestore.AsyncClient(**kwargs)
        logger.info(
            "Initialized FirestoreChatStore project=%s database=%s",
            settings.gcp_project_id,
            settings.firestore_database,
        )

    def _sessions_collection(
        self,
        user_id: str | None,
    ) -> firestore.AsyncCollectionReference:
        if user_id:
            return self._client.collection("users").document(user_id).collection("sessions")
        return self._client.collection("sessions")

    def _session_ref(
        self,
        session_id: str,
        *,
        user_id: str | None = None,
    ) -> firestore.AsyncDocumentReference:
        return self._sessions_collection(user_id).document(session_id)

    def _messages_ref(
        self,
        session_id: str,
        *,
        user_id: str | None = None,
    ) -> firestore.AsyncCollectionReference:
        return self._session_ref(session_id, user_id=user_id).collection("messages")

    async def get_messages(
        self,
        session_id: str,
        *,
        limit: int,
        user_id: str | None = None,
    ) -> list[ChatMessage]:
        if user_id:
            snap = await self._session_ref(session_id, user_id=user_id).get()
            if not snap.exists:
                # New session: empty history is fine; missing foreign id → empty
                # (AuthZ: callers only pass their own uid path, so no leak.)
                pass

        query = (
            self._messages_ref(session_id, user_id=user_id)
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        docs = [doc async for doc in query.stream()]
        messages: list[ChatMessage] = []
        for doc in reversed(docs):
            data = doc.to_dict() or {}
            messages.append(
                ChatMessage(
                    role=data.get("role", "user"),
                    content=data.get("content", ""),
                    created_at=data.get("created_at"),
                )
            )
        return messages

    async def append_messages(
        self,
        session_id: str,
        messages: list[ChatMessage],
        *,
        user_id: str | None = None,
    ) -> None:
        session_ref = self._session_ref(session_id, user_id=user_id)
        messages_ref = self._messages_ref(session_id, user_id=user_id)
        now = datetime.now(UTC)

        snap = await session_ref.get()
        existing = snap.to_dict() or {}
        meta: dict[str, object] = {"updated_at": now}
        if user_id:
            meta["user_id"] = user_id
        if not existing.get("created_at"):
            meta["created_at"] = now

        if not existing.get("title"):
            first_user = next((m for m in messages if m.role == "user"), None)
            if first_user:
                meta["title"] = _truncate(first_user.content, 60)
                meta["title_source"] = "fallback"

        last = messages[-1] if messages else None
        if last:
            meta["preview"] = _truncate(last.content, 80)

        await session_ref.set(meta, merge=True)

        batch = self._client.batch()
        for message in messages:
            created_at = message.created_at or now
            doc_ref = messages_ref.document()
            batch.set(
                doc_ref,
                {
                    "role": message.role,
                    "content": message.content,
                    "created_at": created_at,
                },
            )
        await batch.commit()

    async def list_sessions(
        self,
        *,
        limit: int = 50,
        user_id: str | None = None,
    ) -> list[SessionSummary]:
        query = (
            self._sessions_collection(user_id)
            .order_by("updated_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        sessions: list[SessionSummary] = []
        async for doc in query.stream():
            data = doc.to_dict() or {}
            title = data.get("title") or "New chat"
            sessions.append(
                SessionSummary(
                    session_id=doc.id,
                    title=str(title),
                    preview=str(data.get("preview") or ""),
                    updated_at=data.get("updated_at"),
                )
            )
        return sessions

    async def delete_session(
        self,
        session_id: str,
        *,
        user_id: str | None = None,
    ) -> bool:
        session_ref = self._session_ref(session_id, user_id=user_id)
        snap = await session_ref.get()
        if not snap.exists:
            return False

        messages_ref = self._messages_ref(session_id, user_id=user_id)
        while True:
            docs = [doc async for doc in messages_ref.limit(400).stream()]
            if not docs:
                break
            batch = self._client.batch()
            for doc in docs:
                batch.delete(doc.reference)
            await batch.commit()

        await session_ref.delete()
        logger.info("Deleted session_id=%s user_id=%s", session_id, user_id)
        return True

    async def update_session_title(
        self,
        session_id: str,
        title: str,
        *,
        user_id: str | None = None,
    ) -> bool:
        session_ref = self._session_ref(session_id, user_id=user_id)
        snap = await session_ref.get()
        if not snap.exists:
            return False
        cleaned = _truncate(title, 60)
        await session_ref.set(
            {
                "title": cleaned,
                "title_source": "llm",
                "updated_at": datetime.now(UTC),
            },
            merge=True,
        )
        logger.info(
            "Updated session title session_id=%s user_id=%s title=%r",
            session_id,
            user_id,
            cleaned,
        )
        return True
