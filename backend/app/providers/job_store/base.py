"""Job store protocol — cloud-agnostic job status / lease interface."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol, runtime_checkable

from app.schema import JobRecord, JobStatus, JobType


@runtime_checkable
class JobStore(Protocol):
    """Persist job status for idempotent worker processing."""

    async def create_job(
        self,
        *,
        job_id: str,
        job_type: JobType,
        user_id: str,
        session_id: str,
        created_at: datetime | None = None,
    ) -> JobRecord:
        """Create a queued job if missing; return existing record if already present."""
        ...

    async def get_job(self, *, user_id: str, job_id: str) -> JobRecord | None:
        """Return a job record or None."""
        ...

    async def claim_job(
        self,
        *,
        user_id: str,
        job_id: str,
        lease_seconds: int = 120,
    ) -> JobRecord | None:
        """Atomically claim a job for processing.

        Returns the claimed record, or None if already succeeded / leased by another worker.
        """
        ...

    async def complete_job(
        self,
        *,
        user_id: str,
        job_id: str,
        status: JobStatus,
        result_title: str | None = None,
        error: str | None = None,
    ) -> JobRecord:
        """Mark a job terminal (succeeded/failed). Already-succeeded jobs are left unchanged."""
        ...
