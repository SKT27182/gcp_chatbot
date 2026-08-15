"""FastAPI application entrypoint."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import chat, health
from app.auth.firebase import init_firebase_admin
from app.core.config import Settings, get_settings
from app.providers.job_store.factory import create_job_store
from app.providers.llm.factory import create_llm_client
from app.providers.queue.factory import create_queue_client
from app.providers.store.factory import create_chat_store
from app.services.chat_service import ChatService
from app.services.title_job_service import TitleJobService
from app.utils.logger import get_logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    settings: Settings = app.state.settings
    setup_logging(settings)
    logger = get_logger(__name__)

    if not settings.auth_disabled:
        init_firebase_admin(settings)

    llm = create_llm_client(settings)
    store = create_chat_store(settings)
    queue = create_queue_client(settings)
    jobs = create_job_store(settings)
    title_jobs = TitleJobService(queue=queue, jobs=jobs)
    app.state.chat_service = ChatService(
        llm=llm,
        store=store,
        settings=settings,
        title_jobs=title_jobs,
    )
    app.state.queue_client = queue
    app.state.job_store = jobs
    app.state.title_job_service = title_jobs

    logger.info(
        "App started name=%s env=%s model=%s auth_disabled=%s jobs_enabled=%s cors=%s",
        settings.app_name,
        settings.environment,
        settings.litellm_model,
        settings.auth_disabled,
        settings.jobs_enabled,
        settings.cors_origin_list,
    )
    yield
    logger.info("App shutting down")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(chat.router)
    return app


app = create_app()
