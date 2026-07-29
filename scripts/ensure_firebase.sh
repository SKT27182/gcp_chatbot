#!/usr/bin/env bash
# Ensure Firebase is linked to the GCP project + write frontend/.firebaserc.
# Idempotent. Uses Firebase Management API (reliable) instead of scraping CLI tables.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/_load_root_env.sh"

ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
PROJECT_ID="${GCP_PROJECT_ID:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Set GCP_PROJECT_ID in root .env"
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase CLI required: npm install -g firebase-tools"
  exit 1
fi

firebase_project_active() {
  local token
  if ! command -v gcloud >/dev/null 2>&1; then
    return 1
  fi
  token="$(gcloud auth print-access-token 2>/dev/null || true)"
  [[ -n "${token}" ]] || return 1
  local body
  body="$(curl -sS -o /tmp/fb-project-$$.json -w '%{http_code}' \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}" \
    -H "Authorization: Bearer ${token}" \
    -H "X-Goog-User-Project: ${PROJECT_ID}" 2>/dev/null || echo "000")"
  if [[ "${body}" == "200" ]] && grep -q '"state"[[:space:]]*:[[:space:]]*"ACTIVE"' /tmp/fb-project-$$.json 2>/dev/null; then
    rm -f /tmp/fb-project-$$.json
    return 0
  fi
  rm -f /tmp/fb-project-$$.json
  return 1
}

echo "==> Ensuring Firebase is linked to GCP project: ${PROJECT_ID}"

if firebase_project_active; then
  echo "    Firebase project is ACTIVE — skipping addfirebase"
else
  echo "    Firebase not ACTIVE yet — trying firebase projects:addfirebase"
  if firebase projects:addfirebase "${PROJECT_ID}" --non-interactive; then
    echo "    addfirebase succeeded"
  else
    echo "    addfirebase failed (often OK if already linked via Console)."
    echo "    Re-checking Management API…"
    # IAM / ToS propagation can lag a few seconds after Console enable
    sleep 2
    if ! firebase_project_active; then
      echo "ERROR: Project ${PROJECT_ID} is not an ACTIVE Firebase project."
      echo "  Enable once in Console: https://console.firebase.google.com/ → Add project → select this GCP project"
      echo "  Or: firebase login && firebase projects:addfirebase ${PROJECT_ID}"
      exit 1
    fi
    echo "    Confirmed ACTIVE via API"
  fi
fi

mkdir -p "${FRONTEND_DIR}"
cat > "${FRONTEND_DIR}/.firebaserc" <<EOF
{
  "projects": {
    "default": "${PROJECT_ID}"
  }
}
EOF
echo "==> Wrote frontend/.firebaserc → default=${PROJECT_ID}"
echo "==> Firebase ready for hosting deploy"
