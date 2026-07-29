"""Centralized logging setup. Log level comes from Settings / .env (LOG_LEVEL)."""

from __future__ import annotations

import logging
import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.config import Settings

_CONFIGURED = False


def setup_logging(settings: Settings | None = None) -> None:
    """Configure root logger once with a consistent format and level."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    if settings is None:
        from app.core.config import get_settings

        settings = get_settings()

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Quiet noisy third-party loggers unless debugging
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("google").setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a named logger. Call setup_logging() at app startup first."""
    return logging.getLogger(name)
