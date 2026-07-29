"""Pydantic request/response models for the API (single schema module)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    app: str
    environment: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    session_id: str | None = Field(
        default=None,
        description="Existing session id; omit to start a new conversation.",
    )


class ChatResponse(BaseModel):
    session_id: str
    reply: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime | None = None


class SessionHistoryResponse(BaseModel):
    session_id: str
    messages: list[ChatMessage]
