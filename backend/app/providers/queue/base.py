"""Queue publisher protocol — cloud-agnostic interface."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.schema import JobEnvelope


@runtime_checkable
class QueueClient(Protocol):
    """Publish job envelopes to an async work queue."""

    async def publish(self, job: JobEnvelope) -> str:
        """Publish a job and return a provider message id (or job_id)."""
        ...
