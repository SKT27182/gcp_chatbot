"""Process Pub/Sub title jobs idempotently."""

from __future__ import annotations

from app.core.config import Settings
from app.providers.job_store.base import JobStore
from app.providers.store.base import ChatStore
from app.schema import JobEnvelope
from app.services.title_generator import TitleGenerator
from app.utils.logger import get_logger

logger = get_logger(__name__)


class TitleJobProcessor:
    """Claim → generate → persist title → complete job."""

    def __init__(
        self,
        *,
        jobs: JobStore,
        store: ChatStore,
        generator: TitleGenerator,
        settings: Settings,
    ) -> None:
        self._jobs = jobs
        self._store = store
        self._generator = generator
        self._settings = settings

    async def process(self, envelope: JobEnvelope) -> str:
        """Process a job envelope.

        Returns:
          'succeeded' | 'duplicate' | 'skipped'

        Raises on retryable failures after marking the job failed for this attempt.
        """
        if envelope.job_type != "generate_session_title":
            raise ValueError(f"Unsupported job_type={envelope.job_type}")
        if envelope.schema_version != 1:
            raise ValueError(f"Unsupported schema_version={envelope.schema_version}")

        user_id = envelope.user_id
        job_id = envelope.job_id
        session_id = envelope.payload.session_id

        existing = await self._jobs.get_job(user_id=user_id, job_id=job_id)
        if existing is not None and existing.status == "succeeded":
            logger.info("Duplicate completed job_id=%s — ack", job_id)
            return "duplicate"

        # Ensure a job record exists even if API create was skipped/raced.
        await self._jobs.create_job(
            job_id=job_id,
            job_type=envelope.job_type,
            user_id=user_id,
            session_id=session_id,
            created_at=envelope.created_at,
        )

        claimed = await self._jobs.claim_job(
            user_id=user_id,
            job_id=job_id,
            lease_seconds=self._settings.job_lease_seconds,
        )
        if claimed is None:
            # Another worker holds the lease, or already succeeded.
            latest = await self._jobs.get_job(user_id=user_id, job_id=job_id)
            if latest is not None and latest.status == "succeeded":
                return "duplicate"
            logger.info("Skip claim job_id=%s (lease held or missing)", job_id)
            return "skipped"

        try:
            title = await self._generator.generate(
                user_id=user_id,
                session_id=session_id,
            )
            updated = await self._store.update_session_title(
                session_id,
                title,
                user_id=user_id,
            )
            if not updated:
                raise RuntimeError(f"Session not found for title update: {session_id}")
            await self._jobs.complete_job(
                user_id=user_id,
                job_id=job_id,
                status="succeeded",
                result_title=title,
            )
            logger.info(
                "Title job succeeded job_id=%s session_id=%s title=%r attempts=%s",
                job_id,
                session_id,
                title,
                claimed.attempts,
            )
            return "succeeded"
        except Exception as exc:
            logger.exception(
                "Title job failed job_id=%s session_id=%s attempt=%s",
                job_id,
                session_id,
                claimed.attempts,
            )
            await self._jobs.complete_job(
                user_id=user_id,
                job_id=job_id,
                status="failed",
                error=str(exc) or "title_generation_failed",
            )
            raise
