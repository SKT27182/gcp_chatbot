# FastAPI backend (Phase 3: SSE + Firebase Auth + Pub/Sub title worker)

Config comes from the **repo-root** `.env` (see `docs/development.md`).

## Required secrets / config

| Variable | Purpose |
|----------|---------|
| `LITELLM_API_KEY` | API key for non-Vertex LiteLLM models (`gemini/*`, OpenRouter, etc.) |
| `LITELLM_MODEL` | Title-job / omitted-chat default, e.g. `vertex_ai/gemini-3.5-flash-lite` |
| `LITELLM_BASE_URL` | Optional custom LiteLLM / OpenAI-compatible base URL |
| `GCP_PROJECT_ID` | Firestore + Vertex + Firebase Admin + Pub/Sub project |
| `FIREBASE_PROJECT_ID` | Optional override when Firebase project id differs |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional absolute path to SA JSON (else ADC) |
| `JOBS_ENABLED` | Enable title job publish (Cloud Run sets `true` via Terraform) |
| `PUBSUB_TOPIC` | Topic id (default `chat-jobs` in Terraform) |
| `JOB_LEASE_SECONDS` | Worker lease duration (default 120) |

Chat/session routes require `Authorization: Bearer <Firebase ID token>`. `GET /health` and `GET /models` are public.

Vertex partner/open MaaS models (Gemma, GPT-OSS, Llama, DeepSeek, Qwen) need the `google-cloud-aiplatform` package (LiteLLM imports `vertexai`). Gemini `vertex_ai/` can run without it.

Firestore layout:
- Sessions: `users/{uid}/sessions/{session_id}/messages/{message_id}`
- Jobs: `users/{uid}/jobs/{job_id}`

## Entrypoints

| Process | Module | Port (local) |
|---------|--------|--------------|
| API | `app.main:app` | 8000 |
| Worker | `app.worker.main:app` | 8081 (`make dev-worker`) |

Same Docker image; Cloud Run worker overrides CMD to the worker module.

## Local

```bash
# from repo root — fill root .env first
make env
# gcloud auth application-default login   # Firestore + token verify
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
# optional:
uv run uvicorn app.worker.main:app --reload --port 8081
```

Or `make dev` / `make dev-worker` from root.

Title jobs stay disabled locally unless `JOBS_ENABLED=true` (and usually a real `PUBSUB_TOPIC`).
