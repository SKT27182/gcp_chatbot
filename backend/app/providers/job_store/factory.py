"""Factory for job store implementations based on settings."""

from __future__ import annotations

from app.core.config import Settings
from app.providers.job_store.base import JobStore
from app.providers.job_store.firestore import FirestoreJobStore
from app.providers.job_store.memory import MemoryJobStore
from app.utils.logger import get_logger

logger = get_logger(__name__)


def create_job_store(settings: Settings) -> JobStore:
    if not settings.jobs_enabled or not settings.gcp_project_id:
        logger.info("Using MemoryJobStore (jobs disabled or no GCP project)")
        return MemoryJobStore()
    logger.info("Using FirestoreJobStore project=%s", settings.gcp_project_id)
    return FirestoreJobStore(settings)
