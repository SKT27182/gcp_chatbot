"""Firestore job status adapter."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from google.cloud import firestore

from app.core.config import Settings
from app.schema import JobRecord, JobStatus, JobType
from app.utils.logger import get_logger

logger = get_logger(__name__)


class FirestoreJobStore:
    """JobStore backed by Firestore Native mode.

    Layout:
      users/{user_id}/jobs/{job_id}
    """

    def __init__(self, settings: Settings) -> None:
        if not settings.gcp_project_id:
            raise ValueError("GCP_PROJECT_ID is required for Firestore")

        kwargs: dict[str, str] = {"project": settings.gcp_project_id}
        if settings.firestore_database and settings.firestore_database != "(default)":
            kwargs["database"] = settings.firestore_database

        self._client = firestore.AsyncClient(**kwargs)
        logger.info(
            "Initialized FirestoreJobStore project=%s database=%s",
            settings.gcp_project_id,
            settings.firestore_database,
        )

    def _job_ref(self, user_id: str, job_id: str) -> firestore.AsyncDocumentReference:
        return (
            self._client.collection("users")
            .document(user_id)
            .collection("jobs")
            .document(job_id)
        )

    @staticmethod
    def _from_doc(job_id: str, data: dict) -> JobRecord:
        return JobRecord(
            job_id=job_id,
            job_type=data.get("job_type", "generate_session_title"),
            user_id=str(data.get("user_id", "")),
            session_id=str(data.get("session_id", "")),
            status=data.get("status", "queued"),
            created_at=data.get("created_at") or datetime.now(UTC),
            updated_at=data.get("updated_at") or datetime.now(UTC),
            attempts=int(data.get("attempts") or 0),
            lease_expires_at=data.get("lease_expires_at"),
            last_error=data.get("last_error"),
            result_title=data.get("result_title"),
        )

    async def create_job(
        self,
        *,
        job_id: str,
        job_type: JobType,
        user_id: str,
        session_id: str,
        created_at: datetime | None = None,
    ) -> JobRecord:
        ref = self._job_ref(user_id, job_id)
        now = created_at or datetime.now(UTC)

        @firestore.async_transactional
        async def _create(transaction: firestore.AsyncTransaction) -> JobRecord:
            snap = await ref.get(transaction=transaction)
            if snap.exists:
                return self._from_doc(job_id, snap.to_dict() or {})
            data = {
                "job_id": job_id,
                "job_type": job_type,
                "user_id": user_id,
                "session_id": session_id,
                "status": "queued",
                "created_at": now,
                "updated_at": now,
                "attempts": 0,
                "lease_expires_at": None,
                "last_error": None,
                "result_title": None,
            }
            transaction.set(ref, data)
            return self._from_doc(job_id, data)

        return await _create(self._client.transaction())

    async def get_job(self, *, user_id: str, job_id: str) -> JobRecord | None:
        snap = await self._job_ref(user_id, job_id).get()
        if not snap.exists:
            return None
        return self._from_doc(job_id, snap.to_dict() or {})

    async def claim_job(
        self,
        *,
        user_id: str,
        job_id: str,
        lease_seconds: int = 120,
    ) -> JobRecord | None:
        ref = self._job_ref(user_id, job_id)

        @firestore.async_transactional
        async def _claim(transaction: firestore.AsyncTransaction) -> JobRecord | None:
            snap = await ref.get(transaction=transaction)
            if not snap.exists:
                return None
            data = snap.to_dict() or {}
            record = self._from_doc(job_id, data)
            now = datetime.now(UTC)
            if record.status == "succeeded":
                return None
            if (
                record.status == "running"
                and record.lease_expires_at is not None
                and record.lease_expires_at > now
            ):
                return None
            lease_expires = now + timedelta(seconds=lease_seconds)
            transaction.update(
                ref,
                {
                    "status": "running",
                    "attempts": record.attempts + 1,
                    "updated_at": now,
                    "lease_expires_at": lease_expires,
                    "last_error": None,
                },
            )
            return record.model_copy(
                update={
                    "status": "running",
                    "attempts": record.attempts + 1,
                    "updated_at": now,
                    "lease_expires_at": lease_expires,
                    "last_error": None,
                }
            )

        return await _claim(self._client.transaction())

    async def complete_job(
        self,
        *,
        user_id: str,
        job_id: str,
        status: JobStatus,
        result_title: str | None = None,
        error: str | None = None,
    ) -> JobRecord:
        ref = self._job_ref(user_id, job_id)

        @firestore.async_transactional
        async def _complete(transaction: firestore.AsyncTransaction) -> JobRecord:
            snap = await ref.get(transaction=transaction)
            data = snap.to_dict() or {} if snap.exists else {}
            if snap.exists:
                existing = self._from_doc(job_id, data)
                if existing.status == "succeeded":
                    return existing
            now = datetime.now(UTC)
            updates: dict[str, object] = {
                "status": status,
                "updated_at": now,
                "lease_expires_at": None,
                "last_error": error,
            }
            if result_title is not None:
                updates["result_title"] = result_title
            if snap.exists:
                transaction.update(ref, updates)
                merged = {**data, **updates}
            else:
                transaction.set(ref, updates, merge=True)
                merged = {**data, **updates}
            return self._from_doc(job_id, merged)

        return await _complete(self._client.transaction())
