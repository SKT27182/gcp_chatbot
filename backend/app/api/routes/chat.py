"""Chat routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.auth.deps import get_current_user
from app.auth.models import AuthUser
from app.providers.llm.models import UnknownChatModelError, resolve_chat_model
from app.schema import ChatRequest, ChatResponse, SessionHistoryResponse, SessionListResponse
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    user: AuthUser = Depends(get_current_user),
) -> ChatResponse:
    service = request.app.state.chat_service
    try:
        return await service.chat(payload, user_id=user.uid)
    except UnknownChatModelError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Chat request failed")
        raise HTTPException(status_code=500, detail="Failed to generate chat reply") from exc


@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    request: Request,
    user: AuthUser = Depends(get_current_user),
) -> StreamingResponse:
    service = request.app.state.chat_service
    try:
        # Fail closed before SSE so unknown models are HTTP 400, not a 200 error event.
        resolve_chat_model(
            payload.model,
            default_model=request.app.state.settings.litellm_model,
        )
    except UnknownChatModelError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def event_generator():
        async for chunk in service.chat_stream(payload, user_id=user.uid):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    request: Request,
    user: AuthUser = Depends(get_current_user),
) -> SessionListResponse:
    service = request.app.state.chat_service
    try:
        return await service.list_sessions(user_id=user.uid)
    except Exception as exc:
        logger.exception("Failed to list sessions")
        raise HTTPException(status_code=500, detail="Failed to list sessions") from exc


@router.get("/sessions/{session_id}", response_model=SessionHistoryResponse)
async def get_session(
    session_id: str,
    request: Request,
    user: AuthUser = Depends(get_current_user),
) -> SessionHistoryResponse:
    service = request.app.state.chat_service
    try:
        return await service.get_history(session_id, user_id=user.uid)
    except Exception as exc:
        logger.exception("Failed to load session history session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Failed to load session history") from exc


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    request: Request,
    user: AuthUser = Depends(get_current_user),
) -> None:
    service = request.app.state.chat_service
    try:
        deleted = await service.delete_session(session_id, user_id=user.uid)
    except Exception as exc:
        logger.exception("Failed to delete session session_id=%s", session_id)
        raise HTTPException(status_code=500, detail="Failed to delete session") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
