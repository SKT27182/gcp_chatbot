#!/usr/bin/env bash
# Build/push image, then terraform apply (image + app env from root .env).
# App knobs → Cloud Run via Terraform additional_env_vars.
# Gemini key (gemini/* only) comes from Secret Manager via make push-secrets.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_load_root_env.sh"

ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TF_DIR="${ROOT_DIR}/infra/terraform/gcp/envs/dev"

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID in root .env}"
REGION="${GCP_REGION:-asia-south1}"
REPO="gcp-chatbot"
SERVICE="gcp-chatbot-api"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo latest)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/api:${IMAGE_TAG}-amd64"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI required. See docs/deploy.md"
  exit 1
fi
if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform CLI required for deploy-backend"
  exit 1
fi

# Build additional_env_vars JSON from root .env (non-empty only)
additional_env_vars="{"
first=true
add_var() {
  local name="$1"
  local val="${!name:-}"
  if [[ -n "${val}" ]]; then
    if [[ "${first}" == false ]]; then
      additional_env_vars="${additional_env_vars},"
    fi
    # Escape backslashes and quotes for Terraform map JSON
    val="${val//\\/\\\\}"
    val="${val//\"/\\\"}"
    additional_env_vars="${additional_env_vars}\"${name}\":\"${val}\""
    first=false
  fi
}

add_var "LITELLM_MODEL"
add_var "LITELLM_BASE_URL"
add_var "GCP_LOCATION"
add_var "CORS_ALLOWED_ORIGINS"
add_var "CORS_ORIGINS"
add_var "CHAT_HISTORY_LIMIT"
add_var "LOG_LEVEL"
add_var "COST_LABEL_APP"
add_var "FIREBASE_PROJECT_ID"
# FIRESTORE_DATABASE stays Terraform-owned — do not pass from .env
# (unquoted "(default)" becomes a bash array and breaks Cloud Run as "default")

additional_env_vars="${additional_env_vars}}"

echo "==> Configuring Docker auth for Artifact Registry"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> Building + pushing image: ${IMAGE} (linux/amd64, no attestations)"
docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  -t "${IMAGE}" \
  --push \
  "${ROOT_DIR}/backend"

echo "==> Applying Terraform (image + additional_env_vars from .env)"
terraform -chdir="${TF_DIR}" apply \
  -var="project_id=${PROJECT_ID}" \
  -var="region=${REGION}" \
  -var="cloud_run_image=${IMAGE}" \
  -var="additional_env_vars=${additional_env_vars}" \
  -auto-approve

URL="$(gcloud run services describe "${SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"
echo "==> Deployed: ${URL}"
echo "Add to frontend/.env:  VITE_API_BASE_URL=${URL}"
echo "Then: make deploy-frontend"
