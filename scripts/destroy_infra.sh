#!/usr/bin/env bash
# Tear down Terraform-managed infra + disable Firebase Hosting (project kept).
# Run from repo root via: make tf-destroy
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_load_root_env.sh"

ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TF_DIR="${ROOT_DIR}/infra/terraform/gcp/envs/dev"
PROJECT_ID="${GCP_PROJECT_ID:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Set GCP_PROJECT_ID in root .env"
  exit 1
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform CLI required"
  exit 1
fi

echo "==> Destroying Terraform resources in ${TF_DIR}"
echo "    project=${PROJECT_ID}"
echo "    This removes Cloud Run, Firestore, Artifact Registry, secrets, SA IAM, etc."
echo ""

cd "${TF_DIR}"
terraform init -input=false

# Cloud Run may have deletion_protection=true from earlier applies — clear it first
echo "==> Ensuring Cloud Run deletion_protection=false (so destroy can proceed)"
terraform apply -auto-approve -input=false || true

echo "==> terraform destroy"
terraform destroy -auto-approve -input=false

# Firebase Hosting is CLI-managed (not Terraform)
if command -v firebase >/dev/null 2>&1; then
  echo "==> Disabling Firebase Hosting (if present)"
  firebase hosting:disable --project "${PROJECT_ID}" --non-interactive \
    || echo "    (skipped — hosting already disabled or Firebase CLI not linked)"
else
  echo "==> firebase CLI not found — disable Hosting in Console if needed"
fi

echo "==> Done. GCP project ${PROJECT_ID} still exists (APIs / billing account intact)."
echo "    For zero cost / wipe project: make delete-project"
