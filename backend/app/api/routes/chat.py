"""Chat routes."""

from fastapi import APIRouter, HTTPException, Request

from app.schema import ChatRequest, ChatResponse, SessionHistoryResponse, SessionListResponse
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


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(request: Request) -> SessionListResponse:
    service = request.app.state.chat_service
    try:
        return await service.list_sessions()
    except Exception as exc:
        logger.exception("Failed to list sessions")
        raise HTTPException(status_code=500, detail="Failed to list sessions") from exc


@router.get("/sessions/{session_id}", response_model=SessionHistoryResponse)
async def get_session(session_id: str, request: Request) -> SessionHistoryResponse:
    service = request.app.state.chat_service
    try:
        return await service.get_history(session_id)
    except Exception as exc:
        logger.exception("Failed to load session history session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Failed to load session history") from exc


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str, request: Request) -> None:
    service = request.app.state.chat_service
    try:
        deleted = await service.delete_session(session_id)
    except Exception as exc:
        logger.exception("Failed to delete session session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Failed to delete session") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
