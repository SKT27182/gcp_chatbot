"""Factory for chat store implementations based on settings."""

from __future__ import annotations

import os

from app.core.config import Settings
from app.providers.store.base import ChatStore
from app.providers.store.firestore import FirestoreChatStore
from app.utils.logger import get_logger

logger = get_logger(__name__)


def create_chat_store(settings: Settings) -> ChatStore:
    if settings.google_application_credentials:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = (
            settings.google_application_credentials
        )
    logger.info("Using FirestoreChatStore project=%s", settings.gcp_project_id)
    return FirestoreChatStore(settings)
