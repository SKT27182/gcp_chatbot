"""Health check routes."""

from fastapi import APIRouter, Request

from app.schema import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    return HealthResponse(app=settings.app_name, environment=settings.environment)
