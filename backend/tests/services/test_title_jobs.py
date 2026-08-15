"""Unit tests for title sanitization and job enqueue/process."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime

import pytest

from app.core.config import Settings
from app.providers.job_store.memory import MemoryJobStore
from app.providers.queue.memory import MemoryQueueClient
from app.schema import ChatMessage, GenerateSessionTitlePayload, JobEnvelope
from app.services.title_generator import TitleGenerator, sanitize_title
from app.services.title_job_processor import TitleJobProcessor
from app.services.title_job_service import TitleJobService, title_job_id


def test_sanitize_title_strips_quotes_and_truncates() -> None:
    assert sanitize_title('  "Hello world"  ') == "Hello world"
    assert sanitize_title("**Bold title**") == "Bold title"
    long = "a" * 100
    assert len(sanitize_title(long)) == 60
    assert sanitize_title(long).endswith("…")
    assert sanitize_title("   ") == "New chat"


@pytest.mark.asyncio
async def test_enqueue_title_publishes_once() -> None:
    queue = MemoryQueueClient()
    jobs = MemoryJobStore()
    service = TitleJobService(queue=queue, jobs=jobs)

    job_id = await service.enqueue_generate_title(
        user_id="u1",
        session_id="s1",
    )
    assert job_id == title_job_id("s1")
    assert len(queue.published) == 1
    assert queue.published[0].job_type == "generate_session_title"
    assert queue.published[0].payload.session_id == "s1"

    # Second enqueue while still queued still publishes (worker dedupes by lease/status).
    # Mark succeeded so enqueue short-circuits.
    await jobs.complete_job(
        user_id="u1",
        job_id=job_id,
        status="succeeded",
        result_title="Done",
    )
    again = await service.enqueue_generate_title(user_id="u1", session_id="s1")
    assert again == job_id
    assert len(queue.published) == 1


@pytest.mark.asyncio
async def test_enqueue_publish_failure_marks_failed() -> None:
    class _FailQueue:
        async def publish(self, job: JobEnvelope) -> str:
            raise RuntimeError("pubsub down")

    jobs = MemoryJobStore()
    service = TitleJobService(queue=_FailQueue(), jobs=jobs)  # type: ignore[arg-type]
    result = await service.enqueue_generate_title(user_id="u1", session_id="s-fail")
    assert result is None
    record = await jobs.get_job(user_id="u1", job_id=title_job_id("s-fail"))
    assert record is not None
    assert record.status == "failed"
    assert record.last_error == "publish_failed"


class _FakeLLM:
    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
    ) -> str:
        _ = system_instruction
        return '  "Vacation planning"  '

    async def generate_stream(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
    ) -> AsyncIterator[str]:
        yield await self.generate(messages, system_instruction=system_instruction)


class _FakeStore:
    def __init__(self) -> None:
        self.titles: dict[str, str] = {}
        self.messages: list[ChatMessage] = [
            ChatMessage(role="user", content="Help me plan a trip", created_at=datetime.now(UTC)),
            ChatMessage(role="assistant", content="Sure!", created_at=datetime.now(UTC)),
        ]

    async def get_messages(
        self,
        session_id: str,
        *,
        limit: int,
        user_id: str | None = None,
    ) -> list[ChatMessage]:
        _ = session_id, user_id
        return self.messages[-limit:]

    async def append_messages(self, *args, **kwargs) -> None:
        raise NotImplementedError

    async def list_sessions(self, *args, **kwargs):
        raise NotImplementedError

    async def delete_session(self, *args, **kwargs) -> bool:
        raise NotImplementedError

    async def update_session_title(
        self,
        session_id: str,
        title: str,
        *,
        user_id: str | None = None,
    ) -> bool:
        _ = user_id
        self.titles[session_id] = title
        return True


@pytest.mark.asyncio
async def test_processor_succeeds_and_is_idempotent() -> None:
    jobs = MemoryJobStore()
    store = _FakeStore()
    settings = Settings(
        app_name="test",
        environment="test",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="x",
        gcp_project_id="test",
        jobs_enabled=True,
        job_lease_seconds=30,
    )
    processor = TitleJobProcessor(
        jobs=jobs,
        store=store,
        generator=TitleGenerator(llm=_FakeLLM(), store=store),
        settings=settings,
    )
    envelope = JobEnvelope(
        job_id=title_job_id("s1"),
        job_type="generate_session_title",
        user_id="u1",
        payload=GenerateSessionTitlePayload(session_id="s1"),
        created_at=datetime.now(UTC),
    )

    assert await processor.process(envelope) == "succeeded"
    assert store.titles["s1"] == "Vacation planning"
    record = await jobs.get_job(user_id="u1", job_id=envelope.job_id)
    assert record is not None
    assert record.status == "succeeded"

    assert await processor.process(envelope) == "duplicate"


@pytest.mark.asyncio
async def test_processor_failed_retry_marks_failed() -> None:
    class _BoomLLM(_FakeLLM):
        async def generate(self, messages, *, system_instruction=None) -> str:
            raise RuntimeError("llm boom")

    jobs = MemoryJobStore()
    store = _FakeStore()
    settings = Settings(
        app_name="test",
        environment="test",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="x",
        gcp_project_id="test",
        jobs_enabled=True,
    )
    processor = TitleJobProcessor(
        jobs=jobs,
        store=store,
        generator=TitleGenerator(llm=_BoomLLM(), store=store),
        settings=settings,
    )
    envelope = JobEnvelope(
        job_id=title_job_id("s2"),
        job_type="generate_session_title",
        user_id="u1",
        payload=GenerateSessionTitlePayload(session_id="s2"),
        created_at=datetime.now(UTC),
    )
    with pytest.raises(RuntimeError, match="llm boom"):
        await processor.process(envelope)
    record = await jobs.get_job(user_id="u1", job_id=envelope.job_id)
    assert record is not None
    assert record.status == "failed"
    assert "llm boom" in (record.last_error or "")


@pytest.mark.asyncio
async def test_complete_job_does_not_clobber_succeeded() -> None:
    jobs = MemoryJobStore()
    job_id = title_job_id("s-sticky")
    await jobs.create_job(
        job_id=job_id,
        job_type="generate_session_title",
        user_id="u1",
        session_id="s-sticky",
    )
    await jobs.complete_job(
        user_id="u1",
        job_id=job_id,
        status="succeeded",
        result_title="Keep",
    )
    again = await jobs.complete_job(
        user_id="u1",
        job_id=job_id,
        status="failed",
        error="late fail",
    )
    assert again.status == "succeeded"
    assert again.result_title == "Keep"
    assert again.last_error is None


@pytest.mark.asyncio
async def test_processor_skipped_when_lease_held() -> None:
    jobs = MemoryJobStore()
    store = _FakeStore()
    settings = Settings(
        app_name="test",
        environment="test",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="x",
        gcp_project_id="test",
        jobs_enabled=True,
        job_lease_seconds=30,
    )
    processor = TitleJobProcessor(
        jobs=jobs,
        store=store,
        generator=TitleGenerator(llm=_FakeLLM(), store=store),
        settings=settings,
    )
    envelope = JobEnvelope(
        job_id=title_job_id("s-lease"),
        job_type="generate_session_title",
        user_id="u1",
        payload=GenerateSessionTitlePayload(session_id="s-lease"),
        created_at=datetime.now(UTC),
    )
    await jobs.create_job(
        job_id=envelope.job_id,
        job_type="generate_session_title",
        user_id="u1",
        session_id="s-lease",
    )
    claimed = await jobs.claim_job(
        user_id="u1",
        job_id=envelope.job_id,
        lease_seconds=30,
    )
    assert claimed is not None
    assert await processor.process(envelope) == "skipped"
    assert "s-lease" not in store.titles
