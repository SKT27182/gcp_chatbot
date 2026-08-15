"""Factory for queue clients based on settings."""

from __future__ import annotations

from app.core.config import Settings
from app.providers.queue.base import QueueClient
from app.providers.queue.memory import MemoryQueueClient
from app.providers.queue.pubsub import PubSubQueueClient
from app.utils.logger import get_logger

logger = get_logger(__name__)


def create_queue_client(settings: Settings) -> QueueClient:
    if not settings.jobs_enabled:
        logger.info("Jobs disabled — using MemoryQueueClient")
        return MemoryQueueClient()
    if not settings.pubsub_topic:
        logger.info("PUBSUB_TOPIC unset — using MemoryQueueClient")
        return MemoryQueueClient()
    logger.info("Using PubSubQueueClient topic=%s", settings.pubsub_topic)
    return PubSubQueueClient(settings)
