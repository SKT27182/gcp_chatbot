"""Google Cloud Pub/Sub queue publisher."""

from __future__ import annotations

import asyncio

from google.cloud import pubsub_v1

from app.core.config import Settings
from app.schema import JobEnvelope
from app.utils.logger import get_logger

logger = get_logger(__name__)


class PubSubQueueClient:
    """QueueClient backed by Google Cloud Pub/Sub."""

    def __init__(self, settings: Settings) -> None:
        if not settings.gcp_project_id:
            raise ValueError("GCP_PROJECT_ID is required for Pub/Sub")
        if not settings.pubsub_topic:
            raise ValueError("PUBSUB_TOPIC is required for Pub/Sub")

        self._project_id = settings.gcp_project_id
        self._topic = settings.pubsub_topic
        self._publisher = pubsub_v1.PublisherClient()
        self._topic_path = self._publisher.topic_path(self._project_id, self._topic)
        logger.info(
            "Initialized PubSubQueueClient project=%s topic=%s",
            self._project_id,
            self._topic,
        )

    async def publish(self, job: JobEnvelope) -> str:
        data = job.model_dump_json().encode("utf-8")
        attributes = {
            "job_id": job.job_id,
            "job_type": job.job_type,
            "user_id": job.user_id,
            "schema_version": str(job.schema_version),
        }

        def _publish_sync() -> str:
            future = self._publisher.publish(self._topic_path, data=data, **attributes)
            return str(future.result(timeout=30))

        message_id = await asyncio.to_thread(_publish_sync)
        logger.info(
            "Published job_id=%s type=%s message_id=%s",
            job.job_id,
            job.job_type,
            message_id,
        )
        return str(message_id)
