#!/usr/bin/env bash
# Build frontend and deploy to Firebase Hosting.
# VITE_API_BASE_URL lives in frontend/.env (Vite loads it; not root .env).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_load_root_env.sh"

ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
FRONTEND_ENV="${FRONTEND_DIR}/.env"
PROJECT_ID="${GCP_PROJECT_ID:-}"

if [[ ! -f "${FRONTEND_ENV}" ]]; then
  echo "Missing ${FRONTEND_ENV}"
  echo "  cp frontend/.env.example frontend/.env"
  echo "  Set VITE_API_BASE_URL to your Cloud Run URL (make show-outputs)"
  exit 1
fi

if ! grep -qE '^[[:space:]]*VITE_API_BASE_URL=.+' "${FRONTEND_ENV}"; then
  echo "Set VITE_API_BASE_URL in frontend/.env (run: make show-outputs after backend deploy)"
  exit 1
fi

# Show the value Vite will bake in (from frontend/.env)
API_BASE_URL="$(grep -E '^[[:space:]]*VITE_API_BASE_URL=' "${FRONTEND_ENV}" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"

if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI required: npm install -g firebase-tools (or use npx firebase-tools)"
  exit 1
fi

# Auto-link Firebase to GCP project + write frontend/.firebaserc (no Console)
"${SCRIPT_DIR}/ensure_firebase.sh"

echo "==> Building frontend (VITE_API_BASE_URL from frontend/.env → ${API_BASE_URL})"
cd "${FRONTEND_DIR}"
pnpm install --frozen-lockfile
pnpm build

echo "==> Deploying Firebase Hosting (from frontend/)"
if [[ -n "${PROJECT_ID}" ]]; then
  firebase deploy --only hosting --non-interactive --project "${PROJECT_ID}"
else
  firebase deploy --only hosting --non-interactive
fi

echo "==> Frontend deploy complete."
