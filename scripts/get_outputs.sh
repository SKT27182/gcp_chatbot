#!/usr/bin/env bash
# Print useful live GCP outputs (Cloud Run URL, etc.) for frontend/.env.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_load_root_env.sh"

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-asia-south1}"
SERVICE="gcp-chatbot-api"
WORKER_SERVICE="gcp-chatbot-worker"
TOPIC="chat-jobs"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID in root .env or: gcloud config set project YOUR_ID"
  exit 1
fi

echo "project: ${PROJECT_ID}"
echo "region:  ${REGION}"

if URL="$(gcloud run services describe "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)' 2>/dev/null)"; then
  echo "cloud_run_url: ${URL}"
  echo ""
  echo "Add to frontend/.env:"
  echo "  VITE_API_BASE_URL=${URL}"
  echo "Then: make deploy-frontend"
else
  echo "cloud_run_url: <not deployed yet — run make deploy-backend>"
fi

if WORKER_URL="$(gcloud run services describe "${WORKER_SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)' 2>/dev/null)"; then
  echo "worker_cloud_run_url: ${WORKER_URL}"
else
  echo "worker_cloud_run_url: <not deployed yet>"
fi

if gcloud pubsub topics describe "${TOPIC}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "pubsub_topic: ${TOPIC}"
else
  echo "pubsub_topic: <not created yet — run make tf-apply / deploy-backend>"
fi
