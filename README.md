# GCP Chatbot

Phase-1 split-stack Q/A chatbot: **FastAPI** backend on Cloud Run, **React + Vite** frontend on Firebase Hosting, chat history in Firestore, LLM via **LiteLLM** (Vertex by default).

## Quick start (local)

```bash
make env       # root .env + frontend/.env
make install
make dev
```

Open http://localhost:5173

Edit **root** `.env`: `GCP_PROJECT_ID`, `LITELLM_MODEL`, etc. (see `.env.example`). Frontend API URL: `frontend/.env`. Terraform: small `terraform.tfvars` (`project_id` / `region` / `environment`).

## Repo layout

| Path | Purpose |
|------|---------|
| `backend/` | FastAPI + uv |
| `frontend/` | React + Vite + pnpm |
| `docs/` | Feature-named documentation |
| `infra/terraform/gcp/` | Per-service Terraform modules |
| `scripts/` | Deploy helpers |

## Docs

Start at [docs/README.md](docs/README.md) — architecture, development, deploy, and battle-tested [lessons](docs/lessons.md).
