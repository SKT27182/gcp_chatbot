# Phase-1 FastAPI backend

Config comes from the **repo-root** `.env` (see `docs/development.md`).

## Required secrets / config

| Variable | Purpose |
|----------|---------|
| `LITELLM_API_KEY` | API key for non-Vertex LiteLLM models (`gemini/*`, etc.) |
| `LITELLM_MODEL` | e.g. `vertex_ai/gemini-3.5-flash-lite` or `gemini/…` |
| `LITELLM_BASE_URL` | Optional custom LiteLLM / OpenAI-compatible base URL |
| `GCP_PROJECT_ID` | Firestore + Vertex project |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to service account JSON |

## Local

```bash
# from repo root — fill root .env first
make env
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Or `make dev` from root.
