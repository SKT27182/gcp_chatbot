"""API endpoint tests — fake LLM/store injected via monkeypatch (no mock providers in app)."""

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.schema import ChatMessage


class _FakeLLM:
    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
    ) -> str:
        _ = system_instruction
        last_user = next(m.content for m in reversed(messages) if m.role == "user")
        return f"echo:{last_user} (turns={len(messages)})"


class _FakeStore:
    def __init__(self) -> None:
        self._sessions: dict[str, list[ChatMessage]] = {}

    async def get_messages(self, session_id: str, *, limit: int) -> list[ChatMessage]:
        return self._sessions.get(session_id, [])[-limit:]

    async def append_messages(self, session_id: str, messages: list[ChatMessage]) -> None:
        bucket = self._sessions.setdefault(session_id, [])
        for message in messages:
            bucket.append(
                ChatMessage(
                    role=message.role,
                    content=message.content,
                    created_at=message.created_at or datetime.now(UTC),
                )
            )


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    store = _FakeStore()
    monkeypatch.setattr("app.main.create_llm_client", lambda _settings: _FakeLLM())
    monkeypatch.setattr("app.main.create_chat_store", lambda _settings: store)

    settings = Settings(
        app_name="test-api",
        environment="test",
        log_level="WARNING",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="test-key-not-used",
        gcp_project_id="test-project",
    )
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"] == "test-api"


def test_chat_creates_session_and_follow_up(client: TestClient) -> None:
    first = client.post("/chat", json={"message": "Hello"})
    assert first.status_code == 200
    first_body = first.json()
    assert "session_id" in first_body
    assert "echo:Hello" in first_body["reply"]

    session_id = first_body["session_id"]
    second = client.post(
        "/chat",
        json={"session_id": session_id, "message": "What did I just say?"},
    )
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["session_id"] == session_id
    assert "turns=" in second_body["reply"]

    history = client.get(f"/sessions/{session_id}")
    assert history.status_code == 200
    messages = history.json()["messages"]
    assert len(messages) == 4
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Hello"
