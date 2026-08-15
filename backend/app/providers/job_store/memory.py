"""In-memory job store for local/dev/tests."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.schema import JobRecord, JobStatus, JobType
from app.utils.logger import get_logger

logger = get_logger(__name__)


class MemoryJobStore:
    """JobStore backed by an in-process dict."""

    def __init__(self) -> None:
        self._jobs: dict[tuple[str, str], JobRecord] = {}

    def _key(self, user_id: str, job_id: str) -> tuple[str, str]:
        return (user_id, job_id)

    async def create_job(
        self,
        *,
        job_id: str,
        job_type: JobType,
        user_id: str,
        session_id: str,
        created_at: datetime | None = None,
    ) -> JobRecord:
        key = self._key(user_id, job_id)
        existing = self._jobs.get(key)
        if existing is not None:
            return existing
        now = created_at or datetime.now(UTC)
        record = JobRecord(
            job_id=job_id,
            job_type=job_type,
            user_id=user_id,
            session_id=session_id,
            status="queued",
            created_at=now,
            updated_at=now,
            attempts=0,
        )
        self._jobs[key] = record
        return record

    async def get_job(self, *, user_id: str, job_id: str) -> JobRecord | None:
        return self._jobs.get(self._key(user_id, job_id))

    async def claim_job(
        self,
        *,
        user_id: str,
        job_id: str,
        lease_seconds: int = 120,
    ) -> JobRecord | None:
        key = self._key(user_id, job_id)
        record = self._jobs.get(key)
        if record is None:
            return None
        now = datetime.now(UTC)
        if record.status == "succeeded":
            return None
        if (
            record.status == "running"
            and record.lease_expires_at is not None
            and record.lease_expires_at > now
        ):
            return None
        updated = record.model_copy(
            update={
                "status": "running",
                "attempts": record.attempts + 1,
                "updated_at": now,
                "lease_expires_at": now + timedelta(seconds=lease_seconds),
                "last_error": None,
            }
        )
        self._jobs[key] = updated
        return updated

    async def complete_job(
        self,
        *,
        user_id: str,
        job_id: str,
        status: JobStatus,
        result_title: str | None = None,
        error: str | None = None,
    ) -> JobRecord:
        key = self._key(user_id, job_id)
        record = self._jobs.get(key)
        if record is None:
            raise KeyError(f"job not found: {job_id}")
        if record.status == "succeeded":
            return record
        now = datetime.now(UTC)
        updated = record.model_copy(
            update={
                "status": status,
                "updated_at": now,
                "lease_expires_at": None,
                "result_title": result_title if result_title is not None else record.result_title,
                "last_error": error,
            }
        )
        self._jobs[key] = updated
        return updated
