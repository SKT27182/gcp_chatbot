"""Chat routes."""

from fastapi import APIRouter, HTTPException, Request

from app.schema import ChatRequest, ChatResponse, SessionHistoryResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    service = request.app.state.chat_service
    try:
        return await service.chat(payload)
    except Exception as exc:
        logger.exception("Chat request failed")
        raise HTTPException(status_code=500, detail="Failed to generate chat reply") from exc


@router.get("/sessions/{session_id}", response_model=SessionHistoryResponse)
async def get_session(session_id: str, request: Request) -> SessionHistoryResponse:
    service = request.app.state.chat_service
    try:
        return await service.get_history(session_id)
    except Exception as exc:
        logger.exception("Failed to load session history session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Failed to load session history") from exc
