"""Async title job enqueue helpers."""

from __future__ import annotations

from datetime import UTC, datetime

from app.providers.job_store.base import JobStore
from app.providers.queue.base import QueueClient
from app.schema import GenerateSessionTitlePayload, JobEnvelope
from app.utils.logger import get_logger

logger = get_logger(__name__)

TITLE_JOB_TYPE = "generate_session_title"


def title_job_id(session_id: str) -> str:
    """Deterministic job id — one title job per session."""
    return f"title:{session_id}"


class TitleJobService:
    """Create + publish one-shot session title jobs."""

    def __init__(self, *, queue: QueueClient, jobs: JobStore) -> None:
        self._queue = queue
        self._jobs = jobs

    async def enqueue_generate_title(
        self,
        *,
        user_id: str,
        session_id: str,
    ) -> str | None:
        """Enqueue a title job. Returns job_id, or None on failure (non-fatal)."""
        job_id = title_job_id(session_id)
        now = datetime.now(UTC)
        try:
            record = await self._jobs.create_job(
                job_id=job_id,
                job_type=TITLE_JOB_TYPE,
                user_id=user_id,
                session_id=session_id,
                created_at=now,
            )
            if record.status in ("succeeded", "running"):
                logger.info(
                    "Skip title enqueue job_id=%s status=%s",
                    job_id,
                    record.status,
                )
                return job_id

            envelope = JobEnvelope(
                job_id=job_id,
                job_type=TITLE_JOB_TYPE,
                user_id=user_id,
                payload=GenerateSessionTitlePayload(session_id=session_id),
                created_at=now,
                requested_at=now,
            )
            await self._queue.publish(envelope)
            logger.info(
                "Enqueued title job_id=%s user_id=%s session_id=%s",
                job_id,
                user_id,
                session_id,
            )
            return job_id
        except Exception:
            logger.exception(
                "Failed to enqueue title job session_id=%s user_id=%s",
                session_id,
                user_id,
            )
            try:
                await self._jobs.complete_job(
                    user_id=user_id,
                    job_id=job_id,
                    status="failed",
                    error="publish_failed",
                )
            except Exception:
                logger.exception("Failed to mark title job failed job_id=%s", job_id)
            return None
