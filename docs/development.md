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
| `FIREBASE_PROJECT_ID` | Root `.env` (optional) | When Firebase project id ≠ `GCP_PROJECT_ID` |
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
