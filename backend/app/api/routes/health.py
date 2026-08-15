"""Health and public catalog routes."""

from fastapi import APIRouter, Request

from app.providers.llm.models import default_chat_model, list_vertex_models
from app.schema import HealthResponse, ModelInfo, ModelListResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    return HealthResponse(
        app=settings.app_name,
        environment=settings.environment,
        model=settings.litellm_model,
    )


@router.get("/models", response_model=ModelListResponse)
async def list_models(request: Request) -> ModelListResponse:
    settings = request.app.state.settings
    return ModelListResponse(
        models=[
            ModelInfo(
                id=model.id,
                family=model.family,
                label=model.label,
                location=model.location,
            )
            for model in list_vertex_models()
        ],
        default=default_chat_model(settings.litellm_model),
    )

