# FastAPI backend (Phase 2: SSE + Firebase Auth)

Config comes from the **repo-root** `.env` (see `docs/development.md`).

## Required secrets / config

| Variable | Purpose |
|----------|---------|
| `LITELLM_API_KEY` | API key for non-Vertex LiteLLM models (`gemini/*`, OpenRouter, etc.) |
| `LITELLM_MODEL` | e.g. `vertex_ai/gemini-3.5-flash-lite` or `gemini/…` |
| `LITELLM_BASE_URL` | Optional custom LiteLLM / OpenAI-compatible base URL |
| `GCP_PROJECT_ID` | Firestore + Vertex + Firebase Admin project |
| `FIREBASE_PROJECT_ID` | Optional override when Firebase project id differs |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional absolute path to SA JSON (else ADC) |

Chat/session routes require `Authorization: Bearer <Firebase ID token>`. `GET /health` is public.

Firestore layout: `users/{uid}/sessions/{session_id}/messages/{message_id}`.

## Local

```bash
# from repo root — fill root .env first
make env
# gcloud auth application-default login   # Firestore + token verify
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Or `make dev` from root.
