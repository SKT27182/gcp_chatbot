"""Pydantic request/response models for the API (single schema module)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    app: str
    environment: str
    model: str | None = None



class ModelInfo(BaseModel):
    id: str
    family: str
    label: str
    location: str


class ModelListResponse(BaseModel):
    models: list[ModelInfo]
    default: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    session_id: str | None = Field(
        default=None,
        description="Existing session id; omit to start a new conversation.",
    )
    model: str | None = Field(
        default=None,
        description="Allowlisted vertex_ai/* model id. Omit to use the server default.",
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


class SessionSummary(BaseModel):
    session_id: str
    title: str
    preview: str = ""
    updated_at: datetime | None = None


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]


JobType = Literal["generate_session_title"]
JobStatus = Literal["queued", "running", "succeeded", "failed"]


class GenerateSessionTitlePayload(BaseModel):
    """Payload for a one-shot session title generation job."""

    session_id: str


class JobEnvelope(BaseModel):
    """Versioned, portable job message published to the queue."""

    schema_version: Literal[1] = 1
    job_id: str
    job_type: JobType
    user_id: str
    payload: GenerateSessionTitlePayload
    created_at: datetime
    requested_at: datetime | None = None


class JobRecord(BaseModel):
    """Persisted job status used for leases and idempotent processing."""

    job_id: str
    job_type: JobType
    user_id: str
    session_id: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    attempts: int = 0
    lease_expires_at: datetime | None = None
    last_error: str | None = None
    result_title: str | None = None
