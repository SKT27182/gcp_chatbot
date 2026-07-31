# Lessons (battle-tested)

Living log of **real** failures, cost surprises, and IAM/CORS mistakes.  
**Agents and humans must append here** whenever something breaks during local cloud use or deploy (same PR/change when possible). See `AGENTS.md`.

Format for each entry:

```markdown
### YYYY-MM-DD — short title
- **Symptom:** …
- **Cause:** …
- **Fix:** …
- **Avoid next time:** …
```

---

## Known gotchas (starter set)

### CORS allowlist

Localhost + `https://{GCP_PROJECT_ID}.web.app` are automatic. Optional extras: `CORS_ALLOWED_ORIGINS=https://custom.example.com` (comma-separated, no trailing slash).

### Browser CORS error but curl works

CORS is a browser rule. Confirm `GCP_PROJECT_ID` is set on Cloud Run (Terraform sets it). For a custom domain, set `CORS_ALLOWED_ORIGINS` and redeploy. No trailing slash on origins.

### UI fails after Hosting deploy; API URL “wrong”

`VITE_API_BASE_URL` is baked at **build** time from `frontend/.env`. Rebuild frontend after Cloud Run URL changes (`make show-outputs` → update `frontend/.env` → `make deploy-frontend`).

### Make vs gcloud vs root `.env`

- FastAPI + Make + scripts → **root `.env`**
- `gcloud config set project` alone does not feed Make unless `.env` is missing and the Makefile falls back to gcloud
- Put `GCP_PROJECT_ID` in root `.env`

### Vertex / LiteLLM permission denied

- Local: `gcloud auth application-default login`
- Cloud Run: runtime SA needs `roles/aiplatform.user`
- Check `GCP_PROJECT_ID`, `GCP_LOCATION`, `LITELLM_MODEL`

### Firestore permission denied

Runtime SA needs `roles/datastore.user`. Database must exist (Native) in the expected location.

### TypeScript 6 `baseUrl` deprecation

`frontend/tsconfig.app.json` sets `"ignoreDeprecations": "6.0"`.

### Missing LITELLM_API_KEY / Firestore credentials
- **Symptom:** Local `gemini/*` fails without a key; Vertex fails without ADC/project.
- **Fix:** For `gemini/*` set `LITELLM_API_KEY`. For `vertex_ai/*` use ADC + `GCP_PROJECT_ID` (no API key). Firestore: ADC or SA JSON.

### Cost

Vertex / Gemini tokens are the main Phase-1 bill. Set a budget alert early; prefer Flash + short history.

Filter infra by Billing labels `app=chatbot` / `env=dev` (Terraform). Token attribution needs `vertex_ai/*` + request `labels` — AI Studio API keys are not label-filterable in GCP Billing.

### Firestore has no simple `labels` in Terraform

`google_firestore_database` only supports Resource Manager `tags` (`tagKeys/…`), not `labels={env=…}`. Don’t pass `labels` or apply will fail.

---

## Deploy diary

<!-- Append new dated entries below as you learn them in production. -->

### 2026-07-28 — Chat 500: Vertex model not found (gemini-2.0-flash)
- **Symptom:** UI `{"detail":"Failed to generate chat reply"}`; logs `Publisher model …/gemini-2.0-flash was not found` (404).
- **Cause:** Gemini 2.0 Flash retired (June 2026); also avoid bare ids that 404 in some regions.
- **Fix:** `LITELLM_MODEL=vertex_ai/gemini-2.5-flash` (works in `asia-south1`). Redeploy Cloud Run env (`make deploy-backend` or tf-apply with updated tfvars).
- **Avoid next time:** Prefer current Gemini Flash IDs from Vertex model docs; smoke-test `generateContent` before shipping.
- **Symptom:** Firebase ACTIVE in Console/`projects:list`, but `make deploy-frontend` still runs `addfirebase`, fails, then says project “not visible”.
- **Cause:** Script grepped CLI table output unreliably; `addfirebase` on an already-linked project errors and the same bad check failed again.
- **Fix:** Detect via `GET https://firebase.googleapis.com/v1beta1/projects/{id}` (state=ACTIVE); skip addfirebase when already linked.
- **Avoid next time:** Don’t scrape `firebase projects:list` tables for automation.
- **Symptom:** `Container manifest type 'application/vnd.oci.image.index.v1+json' must support amd64/linux`
- **Cause:** (1) arm64 default on Apple Silicon; (2) BuildKit provenance/SBOM turns the push into an OCI index Cloud Run mishandles.
- **Fix:** `docker buildx build --platform linux/amd64 --provenance=false --sbom=false --push`, tag `…-amd64`.
- **Avoid next time:** Never push default Mac/OrbStack builds to Cloud Run as-is.

### 2026-07-28 — Cloud Run traffic type enum rejected
- **Symptom:** `terraform apply` failed: `expected traffic.0.type to be one of ["TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST" "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION" ""], got TRAFFIC_TARGET_ALLOCATION_TYPE_PERCENT`
- **Cause:** Invalid `traffic.type` in `modules/cloud_run` — percent is a separate field, not the type enum.
- **Fix:** Use `type = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"` with `percent = 100`.
- **Avoid next time:** Copy traffic blocks from current HashiCorp `google_cloud_run_v2_service` docs.

### 2026-07-28 — Cloud Resource Manager API disabled after user_project_override
- **Symptom:** `tf-apply` refresh fails: `Cloud Resource Manager API has not been used … or it is disabled` on every `google_project_service`.
- **Cause:** Provider `user_project_override` / `billing_project` routes quota through the project; that requires `cloudresourcemanager.googleapis.com` (and usually `serviceusage.googleapis.com`).
- **Fix (then):** `gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com --project=…` then `make tf-apply`.
- **Avoid next time:** Don’t use `user_project_override` unless Terraform manages Firebase; prefer Firebase CLI.
- **Symptom:** Infra mostly created, then `Error creating Project: googleapi: Error 403: The caller does not have permission` on `module.firebase_hosting.google_firebase_project`.
- **Cause:** Firebase Management API often rejects end-user ADC from `gcloud auth application-default login`.
- **Fix:** Use `make ensure-firebase` / `make deploy-frontend` (Firebase CLI). Do not manage Firebase via Terraform with user ADC.
- **Avoid next time:** Firebase Hosting = CLI only.

### 2026-07-28 — Dropped bootstrap + TF Firebase; APIs via Terraform only
- **Symptom:** Duplicate API enablement (`bootstrap_gcp.sh` + `google_project_service`) and unused `user_project_override` after Firebase moved to CLI.
- **Cause:** Override flags were for Terraform Firebase; bootstrap was the chicken-and-egg unlock for those flags.
- **Fix:** Removed `scripts/bootstrap_gcp.sh`, `make bootstrap-gcp`, provider override/billing_project, and `modules/firebase_hosting`. APIs stay in Terraform `local.apis`; Hosting stays `ensure-firebase` / `deploy-frontend`.
- **Avoid next time:** Plain `provider "google"` + TF API enablement; Firebase CLI for Hosting.

### 2026-07-28 — Slimmed root .env; app env via additional_env_vars
- **Symptom:** Root `.env` and `terraform.tfvars` both carried model/CORS/repo/service names.
- **Cause:** App knobs were duplicated into Terraform variables and overridden on every deploy.
- **Fix:** Dropped `ARTIFACT_REPO` / `CLOUD_RUN_SERVICE` from `.env`. Slimmed `terraform.tfvars` to `project_id` / `region` / `environment`. App env stays in `.env` and is passed as `additional_env_vars` on `make deploy-backend`.
- **Avoid next time:** App config in `.env`, infra in tfvars; inject app env on deploy — don’t duplicate knobs in both.

### 2026-07-28 — Auto CORS from GCP project id
- **Symptom:** Had to list every Hosting URL in `CORS_ORIGINS` after each deploy.
- **Cause:** CORS was a manual allowlist only.
- **Fix:** API always allows localhost + `https://{GCP_PROJECT_ID}.web.app` / `.firebaseapp.com`; optional `CORS_ALLOWED_ORIGINS` for custom domains.
- **Avoid next time:** Don’t require Hosting URLs in `.env` when project id is already known.

### 2026-07-28 — delete-project clears local Terraform state
- **Symptom:** After deleting a GCP project and creating a new one, `tf-apply` still targeted orphaned state for the old project id.
- **Cause:** `gcloud projects delete` does not remove local `terraform.tfstate`.
- **Fix:** `make delete-project CONFIRM=yes` now backs up/moves `terraform.tfstate` (+ `.firebaserc` if it matched) after scheduling project deletion.
- **Avoid next time:** Don’t manually `mv` state after delete-project — the script handles it.

### 2026-07-28 — FIRESTORE_DATABASE=(default) broken by bash + Cloud Run
- **Symptom:** Chat 500 `Failed to generate chat reply`; logs: `database default does not exist`.
- **Cause:** Unquoted `FIRESTORE_DATABASE=(default)` in `.env` is a bash array when sourced; deploy passed `default` and overwrote Terraform’s `(default)`.
- **Fix:** Quote as `FIRESTORE_DATABASE="(default)"`; stop injecting it via `additional_env_vars`; normalize `default` → `(default)` in Settings.
- **Avoid next time:** Never unquote parentheses in `.env` values that scripts `source`.

### 2026-07-30 — vite build Abort trap 134 (Homebrew Node + ada-url)
- **Symptom:** `make deploy-frontend` / `pnpm build` fails with `pointer being freed was not allocated` / `Abort trap: 6` / exit 134 during `vite build`.
- **Cause:** Homebrew `node` linked against `libada.3.dylib` while `ada-url` only shipped `libada.4`; a forced `libada.3 → libada.4` symlink was ABI-incompatible and crashed malloc.
- **Fix:** Remove the bad symlink; `brew reinstall node` (bottle `26.5.0_1` links `libada.4.dylib`).
- **Avoid next time:** Don’t symlink major dylib versions to “fix” Node; reinstall/upgrade the formula that owns the ABI.

### 2026-07-30 — Custom Domain (Cloudflare + Firebase Hosting) SSL verification
- **Symptom:** Firebase Hosting custom domain SSL provisioning stuck in "Pending" or failing.
- **Cause:** Cloudflare DNS proxy status set to Orange Cloud (Proxied) before ACME verification completed.
- **Fix:** Keep Cloudflare DNS Proxy status set to **DNS Only (Grey Cloud)** during domain verification and Let's Encrypt / GTS certificate issuance. Enable CORS (`CORS_ALLOWED_ORIGINS=https://gcpchatbot.skt27182.com`) and add domain to Firebase Auth Authorized Domains.
- **Avoid next time:** Always use Grey Cloud during Firebase Hosting SSL provisioning.
