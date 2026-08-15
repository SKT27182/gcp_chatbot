"""ChatService title enqueue behavior."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime

import pytest

from app.core.config import Settings
from app.providers.job_store.memory import MemoryJobStore
from app.providers.queue.memory import MemoryQueueClient
from app.schema import ChatMessage, ChatRequest
from app.services.chat_service import ChatService
from app.services.title_job_service import TitleJobService, title_job_id


class _FakeLLM:
    async def generate(self, messages, *, system_instruction=None, model=None) -> str:
        return "reply"

    async def generate_stream(
        self, messages, *, system_instruction=None, model=None
    ) -> AsyncIterator[str]:
        yield "re"
        yield "ply"


class _FakeStore:
    def __init__(self) -> None:
        self._sessions: dict[str, list[ChatMessage]] = {}

    async def get_messages(self, session_id, *, limit, user_id=None):
        return self._sessions.get(session_id, [])[-limit:]

    async def append_messages(self, session_id, messages, *, user_id=None):
        bucket = self._sessions.setdefault(session_id, [])
        for m in messages:
            bucket.append(
                ChatMessage(
                    role=m.role,
                    content=m.content,
                    created_at=m.created_at or datetime.now(UTC),
                )
            )

    async def list_sessions(self, *, limit=50, user_id=None):
        return []

    async def delete_session(self, session_id, *, user_id=None) -> bool:
        return self._sessions.pop(session_id, None) is not None

    async def update_session_title(self, session_id, title, *, user_id=None) -> bool:
        return True


@pytest.mark.asyncio
async def test_chat_enqueues_title_only_on_first_turn() -> None:
    queue = MemoryQueueClient()
    jobs = MemoryJobStore()
    settings = Settings(
        app_name="test",
        environment="test",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="x",
        gcp_project_id="test",
        jobs_enabled=True,
    )
    service = ChatService(
        llm=_FakeLLM(),
        store=_FakeStore(),
        settings=settings,
        title_jobs=TitleJobService(queue=queue, jobs=jobs),
    )

    first = await service.chat(ChatRequest(message="Hello"), user_id="u1")
    assert len(queue.published) == 1
    assert queue.published[0].job_id == title_job_id(first.session_id)

    await service.chat(
        ChatRequest(message="Follow up", session_id=first.session_id),
        user_id="u1",
    )
    assert len(queue.published) == 1


@pytest.mark.asyncio
async def test_chat_skips_enqueue_when_jobs_disabled() -> None:
    queue = MemoryQueueClient()
    jobs = MemoryJobStore()
    settings = Settings(
        app_name="test",
        environment="test",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="x",
        gcp_project_id="test",
        jobs_enabled=False,
    )
    service = ChatService(
        llm=_FakeLLM(),
        store=_FakeStore(),
        settings=settings,
        title_jobs=TitleJobService(queue=queue, jobs=jobs),
    )
    await service.chat(ChatRequest(message="Hello"), user_id="u1")
    assert queue.published == []


@pytest.mark.asyncio
async def test_chat_stream_enqueues_on_success() -> None:
    queue = MemoryQueueClient()
    jobs = MemoryJobStore()
    settings = Settings(
        app_name="test",
        environment="test",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="x",
        gcp_project_id="test",
        jobs_enabled=True,
    )
    service = ChatService(
        llm=_FakeLLM(),
        store=_FakeStore(),
        settings=settings,
        title_jobs=TitleJobService(queue=queue, jobs=jobs),
    )
    events = []
    async for chunk in service.chat_stream(ChatRequest(message="Stream"), user_id="u1"):
        events.append(chunk)
    assert any('"type": "done"' in e or '"type":"done"' in e for e in events)
    assert len(queue.published) == 1


@pytest.mark.asyncio
async def test_chat_enqueues_after_user_only_history() -> None:
    """First stream saved the user turn then failed — next success still enqueues."""
    queue = MemoryQueueClient()
    jobs = MemoryJobStore()
    settings = Settings(
        app_name="test",
        environment="test",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="x",
        gcp_project_id="test",
        jobs_enabled=True,
    )
    store = _FakeStore()
    await store.append_messages(
        "s-retry",
        [ChatMessage(role="user", content="Hello", created_at=datetime.now(UTC))],
        user_id="u1",
    )
    service = ChatService(
        llm=_FakeLLM(),
        store=store,
        settings=settings,
        title_jobs=TitleJobService(queue=queue, jobs=jobs),
    )

    await service.chat(
        ChatRequest(message="Try again", session_id="s-retry"),
        user_id="u1",
    )
    assert len(queue.published) == 1
    assert queue.published[0].job_id == title_job_id("s-retry")

    await service.chat(
        ChatRequest(message="Follow up", session_id="s-retry"),
        user_id="u1",
    )
    assert len(queue.published) == 1
