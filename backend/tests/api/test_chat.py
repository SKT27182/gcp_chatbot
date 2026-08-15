"""API endpoint tests — fake LLM/store + auth override (no mock providers in app)."""

from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.auth.deps import get_current_user
from app.auth.models import AuthUser
from app.core.config import Settings
from app.main import create_app
from app.schema import ChatMessage


class _FakeLLM:
    def __init__(self) -> None:
        self.last_model: str | None = None

    async def generate(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
        model: str | None = None,
    ) -> str:
        _ = system_instruction
        self.last_model = model
        last_user = next(m.content for m in reversed(messages) if m.role == "user")
        return f"echo:{last_user} (turns={len(messages)})"

    async def generate_stream(
        self,
        messages: list[ChatMessage],
        *,
        system_instruction: str | None = None,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        text = await self.generate(
            messages,
            system_instruction=system_instruction,
            model=model,
        )
        # Yield a few chunks so SSE parsing is exercised
        mid = max(1, len(text) // 3)
        yield text[:mid]
        yield text[mid:]


class _FakeStore:
    def __init__(self) -> None:
        # keyed by (user_id or "", session_id)
        self._sessions: dict[tuple[str, str], list[ChatMessage]] = {}
        self._meta: dict[tuple[str, str], dict] = {}

    def _key(self, session_id: str, user_id: str | None) -> tuple[str, str]:
        return (user_id or "", session_id)

    async def get_messages(
        self,
        session_id: str,
        *,
        limit: int,
        user_id: str | None = None,
    ) -> list[ChatMessage]:
        return self._sessions.get(self._key(session_id, user_id), [])[-limit:]

    async def append_messages(
        self,
        session_id: str,
        messages: list[ChatMessage],
        *,
        user_id: str | None = None,
    ) -> None:
        key = self._key(session_id, user_id)
        bucket = self._sessions.setdefault(key, [])
        for message in messages:
            bucket.append(
                ChatMessage(
                    role=message.role,
                    content=message.content,
                    created_at=message.created_at or datetime.now(UTC),
                )
            )
        meta = self._meta.setdefault(key, {})
        if "title" not in meta:
            first_user = next((m for m in messages if m.role == "user"), None)
            if first_user:
                meta["title"] = first_user.content[:60]
        if messages:
            meta["preview"] = messages[-1].content[:80]
        meta["updated_at"] = datetime.now(UTC)

    async def list_sessions(self, *, limit: int = 50, user_id: str | None = None):
        from app.schema import SessionSummary

        uid = user_id or ""
        items = []
        for (owner, session_id), meta in self._meta.items():
            if owner != uid:
                continue
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

    async def delete_session(self, session_id: str, *, user_id: str | None = None) -> bool:
        key = self._key(session_id, user_id)
        if key not in self._sessions and key not in self._meta:
            return False
        self._sessions.pop(key, None)
        self._meta.pop(key, None)
        return True

    async def update_session_title(
        self,
        session_id: str,
        title: str,
        *,
        user_id: str | None = None,
    ) -> bool:
        key = self._key(session_id, user_id)
        if key not in self._meta and key not in self._sessions:
            return False
        meta = self._meta.setdefault(key, {})
        meta["title"] = title[:60]
        meta["title_source"] = "llm"
        meta["updated_at"] = datetime.now(UTC)
        return True


TEST_USER = AuthUser(uid="test-user-1", email="test@example.com", name="Test User")


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    store = _FakeStore()
    llm = _FakeLLM()
    monkeypatch.setattr("app.main.create_llm_client", lambda _settings: llm)
    monkeypatch.setattr("app.main.create_chat_store", lambda _settings: store)

    settings = Settings(
        app_name="test-api",
        environment="test",
        log_level="WARNING",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="test-key-not-used",
        gcp_project_id="test-project",
        auth_disabled=True,
    )
    app = create_app(settings)
    app.state.fake_llm = llm
    app.dependency_overrides[get_current_user] = lambda: TEST_USER
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"] == "test-api"


def test_chat_requires_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.main.create_llm_client", lambda _settings: _FakeLLM())
    monkeypatch.setattr("app.main.create_chat_store", lambda _settings: _FakeStore())
    settings = Settings(
        app_name="test-api",
        environment="test",
        log_level="WARNING",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="test-key",
        gcp_project_id="test-project",
        auth_disabled=True,
    )
    app = create_app(settings)
    with TestClient(app) as test_client:
        response = test_client.post("/chat", json={"message": "Hello"})
        assert response.status_code == 401


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

    # Title stays the first user message after follow-ups
    third = client.post(
        "/chat",
        json={"session_id": session_id, "message": "A later message"},
    )
    assert third.status_code == 200
    listed_again = client.get("/sessions")
    titled = next(s for s in listed_again.json()["sessions"] if s["session_id"] == session_id)
    assert titled["title"] == "Hello"

    deleted = client.delete(f"/sessions/{session_id}")
    assert deleted.status_code == 204
    assert client.get("/sessions").json()["sessions"] == []
    assert client.delete(f"/sessions/{session_id}").status_code == 404


def test_chat_stream_sse(client: TestClient) -> None:
    with client.stream("POST", "/chat/stream", json={"message": "Stream me"}) as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")
        body = "".join(response.iter_text())

    assert '"type": "session"' in body or '"type":"session"' in body
    assert '"type": "token"' in body or '"type":"token"' in body
    assert '"type": "done"' in body or '"type":"done"' in body
    assert "echo:" in body

    listed = client.get("/sessions")
    assert listed.status_code == 200
    assert len(listed.json()["sessions"]) >= 1
    session_id = listed.json()["sessions"][0]["session_id"]
    history = client.get(f"/sessions/{session_id}")
    messages = history.json()["messages"]
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Stream me"
    assert messages[1]["role"] == "assistant"


def test_chat_stream_error_keeps_user_message_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """User turn is persisted before generation; failures do not write assistant/error text."""

    class _FailingStreamLLM:
        async def generate(
            self,
            messages: list[ChatMessage],
            *,
            system_instruction: str | None = None,
            model: str | None = None,
        ) -> str:
            _ = messages, system_instruction, model
            return "unused"

        async def generate_stream(
            self,
            messages: list[ChatMessage],
            *,
            system_instruction: str | None = None,
            model: str | None = None,
        ) -> AsyncIterator[str]:
            _ = messages, system_instruction, model
            yield "partial-"
            raise RuntimeError("simulated LLM failure")

    store = _FakeStore()
    monkeypatch.setattr("app.main.create_llm_client", lambda _settings: _FailingStreamLLM())
    monkeypatch.setattr("app.main.create_chat_store", lambda _settings: store)

    settings = Settings(
        app_name="test-api",
        environment="test",
        log_level="WARNING",
        litellm_model="gemini/gemini-2.0-flash",
        litellm_api_key="test-key-not-used",
        gcp_project_id="test-project",
        auth_disabled=True,
    )
    app = create_app(settings)
    app.dependency_overrides[get_current_user] = lambda: TEST_USER
    with TestClient(app) as test_client:
        with test_client.stream(
            "POST",
            "/chat/stream",
            json={"message": "Save me even if LLM fails"},
        ) as response:
            assert response.status_code == 200
            body = "".join(response.iter_text())

        assert '"type": "error"' in body or '"type":"error"' in body
        assert "simulated LLM failure" in body

        listed = test_client.get("/sessions")
        assert listed.status_code == 200
        sessions = listed.json()["sessions"]
        assert len(sessions) == 1
        session_id = sessions[0]["session_id"]
        assert "Save me even if LLM fails" in sessions[0]["title"]

        history = test_client.get(f"/sessions/{session_id}")
        messages = history.json()["messages"]
        assert len(messages) == 1
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "Save me even if LLM fails"
        assert all(m["role"] != "assistant" for m in messages)

    app.dependency_overrides.clear()


def test_list_models_is_public(client: TestClient) -> None:
    response = client.get("/models")
    assert response.status_code == 200
    body = response.json()
    assert body["default"] == "vertex_ai/gemini-3.5-flash-lite"
    ids = {item["id"] for item in body["models"]}
    assert "vertex_ai/gemini-3.5-flash-lite" in ids
    assert "vertex_ai/gemini-3.7-flash" in ids
    assert "vertex_ai/openai/gpt-oss-20b-maas" in ids
    assert "vertex_ai/qwen/qwen3-next-80b-a3b-instruct-maas" in ids
    assert "vertex_ai/google/gemma-4-26b-a4b-it-maas" in ids
    assert not any(
        "claude" in item or "xai/" in item or "grok" in item or "mistral" in item or "codestral" in item
        for item in ids
    )
    assert all(item["id"].startswith("vertex_ai/") for item in body["models"])


def test_chat_unknown_model_is_400(client: TestClient) -> None:
    response = client.post(
        "/chat",
        json={"message": "Hello", "model": "openai/gpt-4o"},
    )
    assert response.status_code == 400
    assert "disallowed model" in response.json()["detail"]
    assert client.get("/sessions").json()["sessions"] == []


def test_chat_stream_unknown_model_is_400(client: TestClient) -> None:
    response = client.post(
        "/chat/stream",
        json={"message": "Hello", "model": "gemini/gemini-2.0-flash"},
    )
    assert response.status_code == 400
    assert "disallowed model" in response.json()["detail"]


def test_chat_omitted_model_uses_catalog_default(client: TestClient) -> None:
    response = client.post("/chat", json={"message": "Hello"})
    assert response.status_code == 200
    assert client.app.state.fake_llm.last_model == "vertex_ai/gemini-3.5-flash-lite"


def test_chat_uses_requested_catalog_model(client: TestClient) -> None:
    response = client.post(
        "/chat",
        json={"message": "Hello", "model": "vertex_ai/openai/gpt-oss-20b-maas"},
    )
    assert response.status_code == 200
    assert client.app.state.fake_llm.last_model == "vertex_ai/openai/gpt-oss-20b-maas"
