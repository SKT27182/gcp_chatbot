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
        self._meta: dict[str, dict] = {}

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
        meta = self._meta.setdefault(session_id, {})
        if "title" not in meta:
            first_user = next((m for m in messages if m.role == "user"), None)
            if first_user:
                meta["title"] = first_user.content[:60]
        if messages:
            meta["preview"] = messages[-1].content[:80]
        meta["updated_at"] = datetime.now(UTC)

    async def list_sessions(self, *, limit: int = 50):
        from app.schema import SessionSummary

        items = []
        for session_id, meta in self._meta.items():
            items.append(
                SessionSummary(
                    session_id=session_id,
                    title=str(meta.get("title") or "New chat"),
                    preview=str(meta.get("preview") or ""),
                    updated_at=meta.get("updated_at"),
                )
            )
        items.sort(key=lambda s: s.updated_at or datetime.min.replace(tzinfo=UTC), reverse=True)
        return items[:limit]


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

    listed = client.get("/sessions")
    assert listed.status_code == 200
    sessions = listed.json()["sessions"]
    assert len(sessions) >= 1
    assert sessions[0]["session_id"] == session_id
    assert "Hello" in sessions[0]["title"]
