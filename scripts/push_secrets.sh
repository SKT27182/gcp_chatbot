#!/usr/bin/env bash
# Push LITELLM_API_KEY from root .env → Secret Manager (API-key models only).
# Not needed for vertex_ai/* (ADC / Cloud Run SA).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_load_root_env.sh"

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID in root .env}"
# Accept legacy GEMINI_API_KEY name
API_KEY="${LITELLM_API_KEY:-${GEMINI_API_KEY:-}}"
if [[ -z "${API_KEY}" ]]; then
  echo "Set LITELLM_API_KEY in root .env (skip this for vertex_ai/*)"
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI required"
  exit 1
fi

echo "==> Pushing litellm-api-key to Secret Manager (project=${PROJECT_ID})"
printf '%s' "${API_KEY}" | gcloud secrets versions add litellm-api-key \
  --data-file=- \
  --project="${PROJECT_ID}"

echo "==> Done. Cloud Run picks up version 'latest' on next revision / deploy."
echo "    Skip push-secrets when using LITELLM_MODEL=vertex_ai/*."
