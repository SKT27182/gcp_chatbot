"""Application settings loaded from repo-root .env via pydantic-settings."""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py → repo root is parents[3]
_REPO_ROOT = Path(__file__).resolve().parents[3]
_ROOT_ENV = _REPO_ROOT / ".env"

_LOCAL_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
)


class Settings(BaseSettings):
    """Runtime configuration for the chatbot API."""

    model_config = SettingsConfigDict(
        env_file=_ROOT_ENV if _ROOT_ENV.is_file() else None,
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "gcp-chatbot-api"
    environment: str = "local"
    log_level: str = "INFO"
    cloud_provider: str = "gcp"

    host: str = "0.0.0.0"
    port: int = 8000

    # Optional extras only (localhost + *.web.app from project id are automatic)
    cors_allowed_origins: str = Field(
        default="",
        validation_alias=AliasChoices("CORS_ALLOWED_ORIGINS", "CORS_ORIGINS"),
    )

    # LiteLLM — vertex_ai/* uses ADC (no API key). gemini/* / openai/* use LITELLM_API_KEY.
    litellm_model: str = "vertex_ai/gemini-3.5-flash-lite"
    litellm_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("LITELLM_API_KEY", "GEMINI_API_KEY"),
    )
    litellm_base_url: str = ""

    # Path to GCP service account JSON (Firestore + optional vertex_ai/*)
    google_application_credentials: str = ""

    gcp_project_id: str = ""
    # Optional override when Firebase project id differs from GCP project id
    firebase_project_id: str = ""
    gcp_region: str = "asia-south1"
    # Vertex generateContent location — gemini-3.5-flash-lite requires "global"
    gcp_location: str = "global"

    # GCP Billing attribution — match Terraform labels.app / labels.env
    # Used as Vertex generateContent request labels when LITELLM_MODEL=vertex_ai/*
    cost_label_app: str = "chatbot"

    chat_history_limit: int = 20
    firestore_database: str = "(default)"

    @field_validator("log_level", mode="before")
    @classmethod
    def normalize_log_level(cls, value: object) -> str:
        if isinstance(value, str):
            return value.upper()
        return "INFO"

    @field_validator("firestore_database", mode="before")
    @classmethod
    def normalize_firestore_database(cls, value: object) -> object:
        # Unquoted FIRESTORE_DATABASE=(default) in .env becomes bash array → "default"
        if value is None:
            return "(default)"
        if isinstance(value, (list, tuple)) and value:
            value = value[0]
        if isinstance(value, str):
            cleaned = value.strip().strip('"').strip("'")
            if cleaned in ("", "default"):
                return "(default)"
            return cleaned
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        """Localhost + Firebase Hosting URLs from project id + optional extras."""
        origins = list(_LOCAL_CORS_ORIGINS)

        for project_id in (self.firebase_project_id, self.gcp_project_id):
            pid = project_id.strip()
            if not pid:
                continue
            for host in (f"https://{pid}.web.app", f"https://{pid}.firebaseapp.com"):
                if host not in origins:
                    origins.append(host)

        for origin in self.cors_allowed_origins.split(","):
            clean = origin.strip()
            if clean and clean not in origins:
                origins.append(clean)

        return origins

    @property
    def billing_labels(self) -> dict[str, str]:
        """Labels for Vertex AI request billing (env / app / service)."""
        return {
            "env": self.environment.lower(),
            "app": self.cost_label_app.lower(),
            "service": "llm",
        }


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
