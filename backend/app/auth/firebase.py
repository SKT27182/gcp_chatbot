"""Firebase Admin initialization and ID-token verification."""

from __future__ import annotations

from typing import Any

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.auth.models import AuthUser
from app.core.config import Settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

_app: firebase_admin.App | None = None


def init_firebase_admin(settings: Settings) -> None:
    """Initialize Firebase Admin once (ADC / Cloud Run SA)."""
    global _app
    if _app is not None:
        return

    project_id = (settings.firebase_project_id or settings.gcp_project_id).strip()
    if not project_id:
        raise ValueError("GCP_PROJECT_ID (or FIREBASE_PROJECT_ID) is required for Firebase Auth")

    options: dict[str, Any] = {"projectId": project_id}
    try:
        _app = firebase_admin.get_app()
        logger.info("Reusing existing Firebase Admin app project=%s", project_id)
    except ValueError:
        _app = firebase_admin.initialize_app(credentials.ApplicationDefault(), options)
        logger.info("Initialized Firebase Admin project=%s", project_id)


def verify_id_token(id_token: str) -> AuthUser:
    """Verify a Firebase ID token with Google public certs (no private key)."""
    if _app is None:
        raise RuntimeError("Firebase Admin is not initialized")

    decoded = firebase_auth.verify_id_token(id_token)
    uid = decoded.get("uid") or decoded.get("sub")
    if not uid:
        raise ValueError("Token missing uid")
    return AuthUser(
        uid=str(uid),
        email=decoded.get("email"),
        name=decoded.get("name"),
        email_verified=bool(decoded.get("email_verified", False)),
    )

