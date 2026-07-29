# Architecture

Split-stack Q/A chatbot: two independently deployed apps on GCP (Phase 1).

## Components

- **Frontend:** React + Vite SPA on Firebase Hosting
- **Backend:** FastAPI (uvicorn) on Cloud Run
- **LLM:** LiteLLM → Vertex Gemini by default (`LITELLM_MODEL`)
- **History:** Firestore Native (`ChatStore`)
- **Secrets / images:** Secret Manager, Artifact Registry

```mermaid
flowchart TB
  UI[React_Vite_SPA]
  FH[Firebase_Hosting]
  CR[Cloud_Run_FastAPI]
  FS[(Firestore)]
  VA[LiteLLM_Gemini_API]
  AR[Artifact_Registry]

  UI --> FH
  UI -->|POST_/chat_CORS| CR
  CR --> FS
  CR --> VA
  AR -->|image| CR
```

## Request flow

1. User sends a message in the SPA.
2. Frontend `POST`s `{ session_id?, message }` to Cloud Run `/chat`.
3. Backend loads last N messages from Firestore for that session.
4. Backend calls LiteLLM (Vertex) with history + new user turn.
5. Backend appends user + assistant messages to Firestore.
6. Backend returns `{ session_id, reply }`.

API: `GET /health`, `POST /chat`, `GET /sessions/{id}` (debug).

## Portability seams

| Concern | Interface | GCP now |
|---------|-----------|---------|
| LLM | `LLMClient` | `LiteLLMClient` (`gemini/…` + API key, or `vertex_ai/…`) |
| Chat history | `ChatStore` | `FirestoreChatStore` |
| Frontend API host | `VITE_API_BASE_URL` | Cloud Run URL |

Route handlers never import `google.cloud` — only `providers/` do.

## Multi-cloud map

| Capability | GCP (now) | Azure (later) | AWS (later) |
|------------|-----------|---------------|-------------|
| Backend containers | Cloud Run | Container Apps | App Runner / ECS Fargate |
| Frontend static | Firebase Hosting | Static Web Apps / Blob+CDN | Amplify / S3+CloudFront |
| LLM | LiteLLM → Gemini API key (`gemini/…`) | LiteLLM → Azure OpenAI | LiteLLM → Bedrock |
| Chat history | Firestore | Cosmos DB | DynamoDB |
| Secrets | Secret Manager | Key Vault | Secrets Manager |
| Images | Artifact Registry | ACR | ECR |
| Auth (Phase 2) | Identity Platform / Firebase Auth | Entra ID / Easy Auth | Cognito |

Switch LLM clouds mainly via `LITELLM_MODEL` + credentials. Mirror Terraform under `infra/terraform/azure/` and `…/aws/` later.

## Decisions (ADRs)

### ADR-001: Split frontend and backend deploys

React on Firebase Hosting; FastAPI on Cloud Run — separate pipelines, CORS, multi-cloud analogs.

### ADR-002: Cloud Run over GKE / VMs

Scale-to-zero, Docker-portable, low learning cost.

### ADR-003: Firestore for chat history

Native mode only in Phase 1. SQLAlchemy/Alembic deferred until SQL is intentional.

### ADR-004: LiteLLM for chat

`LLMClient` + `LiteLLMClient`. Default Vertex: `vertex_ai/…` + ADC. API-key path: `LITELLM_MODEL` + `LITELLM_API_KEY` (+ optional `LITELLM_BASE_URL`). No mock LLM in the app.

### ADR-005: uv + pnpm only

Lockfile-first; no pip/npm as source of truth.

### ADR-006: uvicorn on Cloud Run

ASGI for FastAPI; Cloud Run scales instances — no gunicorn for Phase 1.

### ADR-007: Few living docs

Consolidate under `docs/` (`architecture`, `development`, `deploy`, `lessons`). Update in place; avoid `docs/phase-N/` folders and one-file-per-tiny-topic sprawl.
