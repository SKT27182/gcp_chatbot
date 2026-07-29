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
| `LITELLM_MODEL` / `GCP_LOCATION` | Root `.env` | Local API + Cloud Run via `additional_env_vars` |
| `CORS_ALLOWED_ORIGINS` | Root `.env` (optional) | Extra origins only; localhost + `*.web.app` are automatic |
| `LITELLM_API_KEY` / `LITELLM_BASE_URL` | Root `.env` | API-key models + `make push-secrets` (not Vertex) |
| `FIRESTORE_DATABASE` | Root `.env` | Local + optional Cloud Run override |
| Infra (`project_id`, `region`, `environment`) | `terraform.tfvars` | Terraform only |
| Firestore local auth | `gcloud auth application-default login` | No JSON file needed |
| Firestore on Cloud Run | Terraform runtime SA | Automatic |

Get an API key: [Google AI Studio](https://aistudio.google.com/apikey).

## Make

```bash
make env
# edit root .env → GCP_PROJECT_ID, LITELLM_MODEL (LITELLM_API_KEY only if not Vertex)
make install
make dev
make test
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
