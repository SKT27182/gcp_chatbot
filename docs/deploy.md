# Deploy (GCP)

## One-time setup

1. GCP project + **billing** + budget alert (~$10–20; Vertex tokens are the main variable cost).
2. Install `gcloud`, Docker, Terraform, Firebase CLI.
3. Auth:

```bash
gcloud auth login
gcloud auth application-default login
firebase login
```

4. Root `.env`: app + GCP settings (see `.env.example`). Terraform tfvars stay small (`project_id` / `region` / `environment`).
5. APIs are enabled by **Terraform** on `make tf-apply`. No bootstrap script.
6. Firebase Hosting is **CLI-only** (not Terraform):
   ```bash
   firebase login          # once per machine
   make ensure-firebase    # or runs automatically inside make deploy-frontend
   ```
   That runs `firebase projects:addfirebase` and writes `frontend/.firebaserc`.

Default region: `asia-south1`.

### Runtime service account

Terraform creates `gcp-chatbot-run` with: `aiplatform.user`, `datastore.user`, `secretmanager.secretAccessor`, `logging.logWriter`. Cloud Run uses this identity (ADC) — no API keys in the frontend.

## Terraform

```text
infra/terraform/gcp/
  modules/   # cloud_run, firestore, artifact_registry, secret_manager, iam
  envs/dev/  # composes modules (+ API enablement)
```

```bash
make tf-init
# copy terraform.tfvars.example → terraform.tfvars
# set project_id (+ region/environment if needed)
make tf-plan
make tf-apply
```

`terraform.tfvars` is infra-only. App env (`LITELLM_MODEL`, `GCP_LOCATION`, …) lives in root `.env` and is passed on `make deploy-backend` as `additional_env_vars`. CORS: localhost + Hosting URLs from `GCP_PROJECT_ID` are automatic.

Suggested order: APIs → AR + IAM + Firestore + secrets → push first image → Cloud Run → `firebase deploy` for Hosting.

### Cost labels

Terraform applies GCP resource labels so Billing can filter this chatbot when others share the project:

| Label | Example | Applied via |
|-------|---------|-------------|
| `env` | `dev` | provider `default_labels` + tfvars `environment` |
| `app` | `chatbot` | provider `default_labels` + tfvars `app_name` |
| `managed_by` | `terraform` | provider `default_labels` |
| `service` | `cloud-run`, `artifact-registry`, `secret-manager` | per module |

**Labeled resources:** Cloud Run (service + revision template), Artifact Registry, Secret Manager.

**Not labeled (API limitation):** API enablement, Firebase project/web app, Firestore DB (only Resource Manager tags, not simple labels), service accounts.

**In Billing:** Reports → Group/Filter by label → `labels.app:chatbot` (or `labels.env:dev`).

**LLM tokens:** Resource labels on Cloud Run do **not** tag Vertex/Gemini token SKUs.

- `LITELLM_MODEL=gemini/…` + API key → AI Studio billing; **no** GCP request labels.
- `LITELLM_MODEL=vertex_ai/…` + ADC/SA → app sends `labels={env,app,service=llm}` on each call (see `COST_LABEL_APP` / `ENVIRONMENT`); those **do** appear in GCP Billing after ~24–48h.

Firebase Hosting spend still shows under Firebase/Hosting product lines (not `labels.app`).

## Backend (Cloud Run)

Dockerfile: `uv sync --frozen`, port **8080**, CMD uvicorn.

```bash
make deploy-backend
make show-outputs
```

Cloud Run gets:
- **Infra env from Terraform:** `GCP_PROJECT_ID`, `FIRESTORE_DATABASE`, labels, secrets mounts
- **App env from root `.env`:** `LITELLM_MODEL`, `GCP_LOCATION`, … via `additional_env_vars`
- **CORS:** localhost + `https://{GCP_PROJECT_ID}.web.app` (and `.firebaseapp.com`) built in the API; optional `CORS_ALLOWED_ORIGINS` for custom domains

`make deploy-backend` builds/pushes the image and applies both.

Cloud Run stays **publicly invokable** for the SPA; Phase 2 locks chat/session routes with **Firebase Auth** (Bearer ID tokens). Request timeout defaults to `300s` for SSE.

`LITELLM_API_KEY` is mounted from Secret Manager when using API-key models (not plain `--set-env-vars`). Skip for `vertex_ai/*`. Firebase Auth does **not** use `make push-secrets`.

### Firebase Auth (deploy)

1. Enable Identity Toolkit API (Terraform `identitytoolkit.googleapis.com`) / Auth in Firebase Console.
2. Sign-in methods: Email/Password, Google, GitHub (GitHub OAuth client secret in Firebase Console only).
3. Set `VITE_FIREBASE_*` in `frontend/.env`, rebuild Hosting (`make deploy-frontend`).
4. Cloud Run runtime SA + ADC is enough for `firebase-admin` token verify — no Auth secret mount.
5. History path: `users/{uid}/sessions/{session_id}/messages` (Phase 1 flat `sessions/*` not migrated).

### LiteLLM

- Always `LiteLLMClient`
- Configure in root `.env` (`LITELLM_MODEL`, `GCP_LOCATION`; or `LITELLM_API_KEY` / optional `LITELLM_BASE_URL` for API-key models)
- Local: FastAPI reads `.env`; Cloud Run: same vars injected on `make deploy-backend`
- **Vertex:** no API key — ADC / Cloud Run SA

### Firestore

- Always Firestore
- Cloud Run: runtime SA (`roles/datastore.user`) — automated by Terraform
- Local: ADC or optional `GOOGLE_APPLICATION_CREDENTIALS`

## Frontend (Firebase Hosting)

- Config in **`frontend/`** (`firebase.json`, gitignored `.firebaserc` from `.firebaserc.example`)
- Serves `frontend/dist` (`"public": "dist"` when deploying from `frontend/`)
- SPA rewrite → `/index.html`
- `VITE_API_BASE_URL` and `VITE_FIREBASE_*` are **build-time** (in `frontend/.env`) — rebuild/redeploy after API URL or Auth config changes

```bash
# set VITE_API_BASE_URL in frontend/.env (Cloud Run URL from make show-outputs)
make deploy-frontend   # builds then firebase deploy from frontend/
```

Add Hosting origin is automatic from `GCP_PROJECT_ID`. For a custom domain, set `CORS_ALLOWED_ORIGINS` in root `.env` and `make deploy-backend`.

### Custom Domain (Cloudflare + Firebase Hosting)

To use a custom domain like `gcpchatbot.skt27182.com` (purchased on Cloudflare):

1. **Firebase Hosting Setup:**
   - Go to Firebase Console → **Build** → **Hosting** → **Add custom domain**.
   - Enter `gcpchatbot.skt27182.com`.
2. **Cloudflare DNS Records:**
   - Add `CNAME` record: Name `gcpchatbot`, Target `https://{GCP_PROJECT_ID}.web.app` (or `A` records provided by Firebase).
   - Set **Proxy Status to DNS Only (Grey Cloud)** while Firebase verifies ownership and issues the SSL cert.
   - Add `TXT` record if requested by Firebase for domain verification.
3. **Firebase Auth:**
   - Go to Firebase Console → **Authentication** → **Settings** → **Authorized domains**.
   - Add `gcpchatbot.skt27182.com`.
4. **Backend CORS:**
   - Add `CORS_ALLOWED_ORIGINS=https://gcpchatbot.skt27182.com` in root `.env`.
   - Run `make deploy-backend` to apply CORS settings to Cloud Run.

## Secrets

**Terraform does not store your real API key.** It only:

1. Creates Secret Manager secret `litellm-api-key` (placeholder version)
2. Creates Cloud Run runtime SA with `secretmanager.secretAccessor` + `datastore.user`
3. Mounts `LITELLM_API_KEY` on Cloud Run from that secret (`latest`)

You push the real key once (or when rotating) — **only for API-key models**, not Vertex:

```bash
# LITELLM_API_KEY must be set in root .env
make push-secrets
```

### Deploy flow

```bash
make tf-apply        # APIs + SA, Firestore, secrets, Cloud Run (copy terraform.tfvars.example first)
make push-secrets    # .env LITELLM_API_KEY → Secret Manager (skip if Vertex-only)
make deploy-backend  # docker build/push + terraform apply (new image; secrets already mounted)
make show-outputs    # paste VITE_API_BASE_URL into frontend/.env
make deploy-frontend # Firebase CLI (auto ensure-firebase)
```

### Teardown (stop cost)

```bash
# A) Remove chatbot infra; keep the GCP project
make tf-destroy

# B) Delete the whole GCP project (near-zero further cost)
make delete-project CONFIRM=yes
```

`delete-project` also backs up/removes local `terraform.tfstate` (and `.firebaserc` if it pointed at that project) so the next project is not stuck on orphaned state. Prefer **B** if this project exists only for the chatbot.

### Local vs Cloud Run auth

| Concern | Local | Cloud Run |
|---------|-------|-----------|
| LiteLLM API key | `LITELLM_API_KEY` in root `.env` (API-key models) | Secret Manager mount (`make push-secrets`) |
| Vertex | ADC / no key | Cloud Run runtime SA |
| Firestore | `gcloud auth application-default login` (or SA JSON path) | Runtime SA from Terraform — **no JSON file** |
