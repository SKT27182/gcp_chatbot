# Development

## Prerequisites

- Python 3.12 (`backend/.python-version`), Node 20+, **pnpm**
- **LITELLM_API_KEY** in root `.env` only for API-key models (`gemini/*`, etc.). **Not** for `vertex_ai/*`.
- **GCP service account JSON** path in `GOOGLE_APPLICATION_CREDENTIALS` (Firestore)
- Firestore database in your GCP project

## What you need (and where)

| Secret / config | Where | Used for |
|-----------------|-------|----------|
| `GCP_PROJECT_ID` / `GCP_REGION` | Root `.env` | Local + deploy scripts + TF `-var`; also drives Hosting CORS |
| `LITELLM_MODEL` / `GCP_LOCATION` | Root `.env` | Title-job default + omitted chat `model`; Cloud Run via `additional_env_vars` |
| `CORS_ALLOWED_ORIGINS` | Root `.env` (optional) | Extra origins only; localhost + `*.web.app` are automatic |
| `LITELLM_API_KEY` / `LITELLM_BASE_URL` | Root `.env` | API-key models + `make push-secrets` (not Vertex) |
| `FIRESTORE_DATABASE` | Root `.env` | Local + optional Cloud Run override |
| `FIREBASE_PROJECT_ID` | Root `.env` (optional) | When Firebase project id ≠ `GCP_PROJECT_ID` |
| `JOBS_ENABLED` / `PUBSUB_TOPIC` | Root `.env` (optional locally) | Phase 3 title jobs; Cloud Run sets via Terraform |
| `VITE_FIREBASE_*` | `frontend/.env` | Firebase Auth web config (build-time) |
| Infra (`project_id`, `region`, `environment`) | `terraform.tfvars` | Terraform only |
| Firestore + Firebase Admin local auth | `gcloud auth application-default login` | No JSON file needed |
| Firestore on Cloud Run | Terraform runtime SA | Automatic |

Get an API key: [Google AI Studio](https://aistudio.google.com/apikey).

## Firebase Auth (local)

1. Firebase Console → Authentication → enable **Email/Password**, **Google**, **GitHub**.
2. Add a Web app; copy config into `frontend/.env` (`VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`).
3. Authorized domains: `localhost` and your Hosting domain.
4. Backend: same ADC as Firestore (`gcloud auth application-default login`) so `firebase-admin` can verify ID tokens.
5. Smoke: sign in → send a message → confirm SSE tokens and a session under `users/{uid}/sessions/` in Firestore.

## Phase 3 title jobs (local)

- Default: `JOBS_ENABLED` is false → API uses `MemoryQueueClient` / `MemoryJobStore` (no Pub/Sub).
- Chat still writes the truncated fallback title immediately.
- Optional local worker: `make dev-worker` (port 8081). Against real GCP, set `JOBS_ENABLED=true` and `PUBSUB_TOPIC=chat-jobs` in root `.env` (same ADC as Firestore).
- Pub/Sub emulator is optional; for learning, prefer deploying and watching the private worker logs after `make deploy-backend`.

## Vertex chat models (local)

- `GET /models` is public and returns the Vertex allowlist (Gemini, GPT-OSS, Llama, DeepSeek, Qwen, Gemma). Each entry has its own location (`global` vs `us-central1`).
- The SPA picker stores the last choice in `localStorage` (`gcp-chatbot-session`) and sends `model` on `/chat` and `/chat/stream`.
- Omitted `model` uses `LITELLM_MODEL` if that id is on the allowlist, otherwise `vertex_ai/gemini-3.5-flash-lite`.
- Title jobs ignore the picker and always use `LITELLM_MODEL`.
- Open/partner MaaS models (GPT-OSS / Llama / DeepSeek / Qwen / Gemma) must be **Enabled** in Vertex Model Garden for the same `GCP_PROJECT_ID`. Gemini works with existing `roles/aiplatform.user`.
- A 429 `RESOURCE_EXHAUSTED` / `Quota exceeded for …_per_base_model` after Enable is Vertex quota (often 0 until you request an increase) — not a wrong model id.
- Non-Gemini Vertex models also need the `google-cloud-aiplatform` package in the API image (LiteLLM imports `vertexai`).

## Make

```bash
make env
# edit root .env → GCP_PROJECT_ID, LITELLM_MODEL (LITELLM_API_KEY only if not Vertex)
make install
make dev
make test
```

Optional worker process:

```bash
make dev-worker
```

## Environment files

| File | Who reads it |
|------|----------------|
| **Root `.env`** | Make, scripts, FastAPI |
| **`frontend/.env`** | Vite (`VITE_API_BASE_URL`) |
| **`frontend/.firebaserc`** | Firebase CLI (gitignored) |

## CORS / logging

- CORS: localhost + Hosting from `GCP_PROJECT_ID` are automatic; optional `CORS_ALLOWED_ORIGINS` for custom domains
- `LOG_LEVEL` via `app/utils/logger.py`
