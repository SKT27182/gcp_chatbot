#!/usr/bin/env bash
# Delete the entire GCP project (nuclear — stops nearly all project cost).
# Also clears local Terraform state so the next project starts clean.
# Run from repo root via: make delete-project CONFIRM=yes
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_load_root_env.sh"

ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TF_DIR="${ROOT_DIR}/infra/terraform/gcp/envs/dev"
FRONTEND_DIR="${ROOT_DIR}/frontend"

PROJECT_ID="${GCP_PROJECT_ID:-}"
CONFIRM="${CONFIRM:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Set GCP_PROJECT_ID in root .env"
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI required"
  exit 1
fi

if [[ "${CONFIRM}" != "yes" ]]; then
  echo "This PERMANENTLY deletes GCP project: ${PROJECT_ID}"
  echo "  (Cloud Run, Firestore, AR, Firebase on that project, secrets, …)"
  echo "  Also backs up and removes local Terraform state under envs/dev/."
  echo ""
  echo "Re-run with explicit confirmation:"
  echo "  make delete-project CONFIRM=yes"
  exit 1
fi

echo "==> Scheduling deletion of project: ${PROJECT_ID}"
if gcloud projects delete "${PROJECT_ID}" --quiet; then
  echo "    Delete requested (pending deletion; restore window ~30 days in Console)."
else
  echo "    gcloud delete failed or project already gone — continuing with local cleanup."
fi

# Orphaned state from a deleted project breaks the next project's tf-apply
echo "==> Clearing local Terraform state (${TF_DIR})"
mkdir -p "${TF_DIR}"
stamp="$(date +%Y%m%d-%H%M%S)"
if [[ -f "${TF_DIR}/terraform.tfstate" ]]; then
  bak="${TF_DIR}/terraform.tfstate.${PROJECT_ID}.${stamp}.bak"
  mv "${TF_DIR}/terraform.tfstate" "${bak}"
  echo "    Moved terraform.tfstate → $(basename "${bak}")"
fi
if [[ -f "${TF_DIR}/terraform.tfstate.backup" ]]; then
  bak="${TF_DIR}/terraform.tfstate.backup.${PROJECT_ID}.${stamp}.bak"
  mv "${TF_DIR}/terraform.tfstate.backup" "${bak}"
  echo "    Moved terraform.tfstate.backup → $(basename "${bak}")"
fi
# Drop empty state leftovers if any
rm -f "${TF_DIR}/.terraform.tfstate.lock.info" 2>/dev/null || true

# Firebase CLI project pointer for the deleted project
FIREBASERC="${FRONTEND_DIR}/.firebaserc"
if [[ -f "${FIREBASERC}" ]] && grep -q "${PROJECT_ID}" "${FIREBASERC}" 2>/dev/null; then
  bak="${FIREBASERC}.${PROJECT_ID}.${stamp}.bak"
  mv "${FIREBASERC}" "${bak}"
  echo "==> Moved frontend/.firebaserc → $(basename "${bak}") (was ${PROJECT_ID})"
fi

echo ""
echo "==> Done."
echo "    Next project:"
echo "      1. Set GCP_PROJECT_ID in root .env + project_id in terraform.tfvars"
echo "      2. gcloud config set project YOUR_NEW_PROJECT_ID"
echo "      3. make tf-apply && make deploy-backend && make show-outputs"
echo "      4. Set VITE_API_BASE_URL in frontend/.env → make deploy-frontend"
