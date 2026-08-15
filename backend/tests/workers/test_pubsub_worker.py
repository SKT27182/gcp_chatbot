"""Worker Pub/Sub push endpoint tests."""

from __future__ import annotations

import asyncio
import base64
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.providers.job_store.memory import MemoryJobStore
from app.schema import ChatMessage, GenerateSessionTitlePayload, JobEnvelope
from app.services.title_job_service import title_job_id
from app.worker.main import create_worker_app


class _FakeLLM:
    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
    ) -> str:
        _ = messages, system_instruction
        return "Sidebar Title"

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
        self.messages = [
            ChatMessage(role="user", content="Hi", created_at=datetime.now(UTC)),
            ChatMessage(role="assistant", content="Hello", created_at=datetime.now(UTC)),
        ]

    async def get_messages(self, session_id, *, limit, user_id=None):
        return self.messages[-limit:]

    async def append_messages(self, *args, **kwargs) -> None:
        raise NotImplementedError

    async def list_sessions(self, *args, **kwargs):
        raise NotImplementedError

    async def delete_session(self, *args, **kwargs) -> bool:
        raise NotImplementedError

    async def update_session_title(self, session_id, title, *, user_id=None) -> bool:
        self.titles[session_id] = title
        return True


@pytest.fixture
def worker_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    store = _FakeStore()
    jobs = MemoryJobStore()
    settings = Settings(
        app_name="test-api",
        environment="test",
        log_level="WARNING",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="test-key",
        gcp_project_id="test-project",
        jobs_enabled=True,
        auth_disabled=True,
    )

    monkeypatch.setattr("app.worker.main.create_llm_client", lambda _s: _FakeLLM())
    monkeypatch.setattr("app.worker.main.create_chat_store", lambda _s: store)
    monkeypatch.setattr("app.worker.main.create_job_store", lambda _s: jobs)

    app = create_worker_app(settings)
    with TestClient(app) as client:
        client.store = store  # type: ignore[attr-defined]
        client.jobs = jobs  # type: ignore[attr-defined]
        yield client


def _push_body(envelope: JobEnvelope) -> dict:
    data = base64.b64encode(envelope.model_dump_json().encode("utf-8")).decode("ascii")
    return {
        "message": {
            "data": data,
            "messageId": "m1",
            "attributes": {"job_id": envelope.job_id},
        },
        "subscription": "projects/test/subscriptions/chat-jobs-worker",
        "deliveryAttempt": 1,
    }


def test_worker_health(worker_client: TestClient) -> None:
    response = worker_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "worker" in response.json()["app"]


def test_worker_push_happy_path(worker_client: TestClient) -> None:
    envelope = JobEnvelope(
        job_id=title_job_id("sess-1"),
        job_type="generate_session_title",
        user_id="user-1",
        payload=GenerateSessionTitlePayload(session_id="sess-1"),
        created_at=datetime.now(UTC),
    )
    response = worker_client.post("/internal/pubsub/title", json=_push_body(envelope))
    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"
    assert worker_client.store.titles["sess-1"] == "Sidebar Title"  # type: ignore[attr-defined]


def test_worker_push_malformed_returns_400(worker_client: TestClient) -> None:
    response = worker_client.post(
        "/internal/pubsub/title",
        json={"message": {"data": base64.b64encode(b"not-json").decode()}},
    )
    assert response.status_code == 400


def test_worker_push_duplicate_acks(worker_client: TestClient) -> None:
    envelope = JobEnvelope(
        job_id=title_job_id("sess-2"),
        job_type="generate_session_title",
        user_id="user-1",
        payload=GenerateSessionTitlePayload(session_id="sess-2"),
        created_at=datetime.now(UTC),
    )
    first = worker_client.post("/internal/pubsub/title", json=_push_body(envelope))
    assert first.status_code == 200
    second = worker_client.post("/internal/pubsub/title", json=_push_body(envelope))
    assert second.status_code == 200
    assert second.json()["status"] == "duplicate"


def test_worker_push_skipped_lease_returns_503(worker_client: TestClient) -> None:
    jobs: MemoryJobStore = worker_client.jobs  # type: ignore[attr-defined]
    envelope = JobEnvelope(
        job_id=title_job_id("sess-skip"),
        job_type="generate_session_title",
        user_id="user-1",
        payload=GenerateSessionTitlePayload(session_id="sess-skip"),
        created_at=datetime.now(UTC),
    )

    async def _hold_lease() -> None:
        await jobs.create_job(
            job_id=envelope.job_id,
            job_type="generate_session_title",
            user_id="user-1",
            session_id="sess-skip",
        )
        claimed = await jobs.claim_job(
            user_id="user-1",
            job_id=envelope.job_id,
            lease_seconds=120,
        )
        assert claimed is not None

    asyncio.run(_hold_lease())
    response = worker_client.post("/internal/pubsub/title", json=_push_body(envelope))
    assert response.status_code == 503
    assert "lease held" in response.json()["detail"]
