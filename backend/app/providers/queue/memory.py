"""In-memory queue client for local/dev/tests when Pub/Sub is disabled."""

from __future__ import annotations

from app.schema import JobEnvelope
from app.utils.logger import get_logger

logger = get_logger(__name__)


class MemoryQueueClient:
    """Records published jobs in memory; does not deliver to a worker."""

    def __init__(self) -> None:
        self.published: list[JobEnvelope] = []

    async def publish(self, job: JobEnvelope) -> str:
        self.published.append(job)
        logger.info(
            "MemoryQueue published job_id=%s type=%s session_id=%s",
            job.job_id,
            job.job_type,
            job.payload.session_id,
        )
        return job.job_id
