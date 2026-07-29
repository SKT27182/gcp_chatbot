#!/usr/bin/env bash
# Source this from other scripts:  source "$(dirname "$0")/_load_root_env.sh"
# Loads repo-root .env into the current shell (if present).

_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${_ROOT}/.env"
  set +a
fi
