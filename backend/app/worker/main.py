"""Private Cloud Run worker — Pub/Sub push handler for title jobs."""

from __future__ import annotations

import base64
import json
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field, ValidationError

from app.core.config import Settings, get_settings
from app.providers.job_store.factory import create_job_store
from app.providers.llm.factory import create_llm_client
from app.providers.store.factory import create_chat_store
from app.schema import JobEnvelope
from app.services.title_generator import TitleGenerator
from app.services.title_job_processor import TitleJobProcessor
from app.utils.logger import get_logger, setup_logging


class PubSubPushMessage(BaseModel):
    data: str | None = None
    messageId: str | None = None
    message_id: str | None = None
    attributes: dict[str, str] | None = None
    publishTime: str | None = None
    publish_time: str | None = None


class PubSubPushEnvelope(BaseModel):
    message: PubSubPushMessage
    subscription: str | None = None
    deliveryAttempt: int | None = Field(default=None, alias="deliveryAttempt")


def decode_job_envelope(message: PubSubPushMessage) -> JobEnvelope:
    if not message.data:
        raise ValueError("Pub/Sub message missing data")
    raw = base64.b64decode(message.data)
    payload: dict[str, Any] = json.loads(raw.decode("utf-8"))
    return JobEnvelope.model_validate(payload)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings: Settings = app.state.settings
    setup_logging(settings)
    logger = get_logger(__name__)

    llm = create_llm_client(settings)
    store = create_chat_store(settings)
    jobs = create_job_store(settings)
    generator = TitleGenerator(llm=llm, store=store)
    app.state.processor = TitleJobProcessor(
        jobs=jobs,
        store=store,
        generator=generator,
        settings=settings,
    )

    logger.info(
        "Worker started env=%s model=%s jobs_enabled=%s",
        settings.environment,
        settings.litellm_model,
        settings.jobs_enabled,
    )
    yield
    logger.info("Worker shutting down")


def create_worker_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title=f"{settings.app_name}-worker", lifespan=lifespan)
    app.state.settings = settings

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "app": f"{settings.app_name}-worker",
            "environment": settings.environment,
        }

    @app.post("/internal/pubsub/title")
    async def pubsub_title_push(request: Request) -> dict[str, str]:
        logger = get_logger(__name__)
        try:
            body = await request.json()
            push = PubSubPushEnvelope.model_validate(body)
            envelope = decode_job_envelope(push.message)
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            # 400 → Pub/Sub retries then DLQ. Do not ACK poison messages with 2xx.
            logger.warning("Malformed Pub/Sub push: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Malformed Pub/Sub message: {exc}",
            ) from exc

        processor: TitleJobProcessor = request.app.state.processor
        delivery = push.deliveryAttempt
        logger.info(
            "Pub/Sub push job_id=%s user_id=%s session_id=%s delivery=%s message_id=%s",
            envelope.job_id,
            envelope.user_id,
            envelope.payload.session_id,
            delivery,
            push.message.messageId or push.message.message_id,
        )
        try:
            result = await processor.process(envelope)
        except Exception as exc:
            # Non-2xx → Pub/Sub retries until DLQ.
            logger.exception("Worker processing failed job_id=%s", envelope.job_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc) or "title job failed",
            ) from exc

        if result == "skipped":
            # Lease held by another worker — nack so Pub/Sub retries instead of ACK.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="title job lease held",
            )

        return {"status": result}

    return app


app = create_worker_app()
