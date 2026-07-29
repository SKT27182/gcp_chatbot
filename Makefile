# GCP Chatbot — common developer commands
# Run `make` or `make help` to list targets.

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BACKEND := $(ROOT)/backend
FRONTEND := $(ROOT)/frontend

# Load root .env into Make (same pattern as production-shaped repos).
# Priority: CLI override > root .env > gcloud active project.
ifneq ("$(wildcard $(ROOT)/.env)","")
  include $(ROOT)/.env
  export
endif

GCP_PROJECT_ID ?= $(shell gcloud config get-value project 2>/dev/null)
GCP_REGION ?= asia-south1

.DEFAULT_GOAL := help

.PHONY: help install install-backend install-frontend env \
	dev dev-backend dev-frontend \
	test test-backend build build-frontend build-backend \
	deploy deploy-backend deploy-frontend ensure-firebase show-outputs push-secrets \
	tf-init tf-plan tf-apply tf-destroy delete-project lint

help: ## Show this help
	@echo "GCP Chatbot Make targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(ROOT)/Makefile | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Config: copy .env.example → .env at repo root (Make + deploy scripts read it)."
	@echo "  GCP_PROJECT_ID   (from .env or gcloud config)"
	@echo "  GCP_REGION       (default: asia-south1)"
	@echo "  CORS            (auto: localhost + {GCP_PROJECT_ID}.web.app; optional CORS_ALLOWED_ORIGINS)"
	@echo "  VITE_API_BASE_URL (frontend/.env — set Cloud Run URL after make show-outputs)"
	@echo "  LITELLM_API_KEY  (root .env — API-key models only; skip for vertex_ai/*)"
	@echo "  LITELLM_MODEL    (root .env — local + Cloud Run via deploy-backend)"
	@echo "  Local Firestore: gcloud auth application-default login (or SA JSON path)"
	@echo ""
	@echo "Active project: $(or $(GCP_PROJECT_ID),<none>)"

# ── Setup ────────────────────────────────────────────────────────────────────

install: install-backend install-frontend ## Install backend + frontend deps

install-backend: ## uv sync in backend/
	cd $(BACKEND) && uv sync

install-frontend: ## pnpm install in frontend/
	cd $(FRONTEND) && pnpm install

env: ## Copy .env.example → .env if missing (root + frontend); .firebaserc.example → .firebaserc
	@test -f $(ROOT)/.env || cp $(ROOT)/.env.example $(ROOT)/.env
	@test -f $(FRONTEND)/.env || cp $(FRONTEND)/.env.example $(FRONTEND)/.env
	@test -f $(FRONTEND)/.firebaserc || cp $(FRONTEND)/.firebaserc.example $(FRONTEND)/.firebaserc
	@echo "Env files ready (existing files left unchanged)."
	@echo "Edit root .env for app + Make/deploy."
	@echo "Edit frontend/.firebaserc with your Firebase/GCP project id."
	@echo "frontend/.env is for Vite local only."

# ── Local development ────────────────────────────────────────────────────────

dev: env ## Run API + Vite together (Ctrl+C stops both)
	@$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Run FastAPI with reload on :8000
	cd $(BACKEND) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Run Vite on :5173
	cd $(FRONTEND) && pnpm dev

# ── Quality ──────────────────────────────────────────────────────────────────

test: test-backend ## Run all tests

test-backend: ## Run backend pytest
	cd $(BACKEND) && uv run pytest -q

lint: ## Lint frontend (oxlint)
	cd $(FRONTEND) && pnpm lint

# ── Build ────────────────────────────────────────────────────────────────────

build: build-frontend build-backend ## Build frontend dist + backend Docker image (local tag)

build-frontend: ## pnpm build → frontend/dist
	cd $(FRONTEND) && pnpm build

build-backend: ## docker build backend image locally as gcp-chatbot-api:local
	docker build -t gcp-chatbot-api:local $(BACKEND)

# ── GCP / Firebase ───────────────────────────────────────────────────────────
# APIs are enabled by Terraform (make tf-apply). Firebase Hosting is CLI-only.

ensure-firebase: ## Link Firebase to GCP project via CLI (no Console) + write .firebaserc
ifeq ($(strip $(GCP_PROJECT_ID)),)
	$(error No project set. Put GCP_PROJECT_ID in root .env)
endif
	$(ROOT)/scripts/ensure_firebase.sh

push-secrets: ## Push LITELLM_API_KEY from .env → Secret Manager (not needed for vertex_ai/*)
ifeq ($(strip $(GCP_PROJECT_ID)),)
	$(error No project set. Put GCP_PROJECT_ID in root .env)
endif
	$(ROOT)/scripts/push_secrets.sh

deploy-backend: ## Build/push image + terraform apply (secrets mounted from SM)
ifeq ($(strip $(GCP_PROJECT_ID)),)
	$(error No project set. Put GCP_PROJECT_ID in root .env, or: gcloud config set project YOUR_ID)
endif
	@echo "Using GCP_PROJECT_ID=$(GCP_PROJECT_ID)"
	$(ROOT)/scripts/deploy_backend.sh

deploy-frontend: ## Build + Firebase Hosting (needs VITE_API_BASE_URL in frontend/.env)
	$(ROOT)/scripts/deploy_frontend.sh

deploy: ## Deploy backend then frontend
	$(MAKE) deploy-backend
	@echo "Tip: run make show-outputs, set VITE_API_BASE_URL in frontend/.env, then make deploy-frontend"
	$(MAKE) deploy-frontend

show-outputs: ## Print Cloud Run URL for .env
	$(ROOT)/scripts/get_outputs.sh

# ── Terraform ────────────────────────────────────────────────────────────────

# Always run from envs/dev (repo root has no .tf files — plain `terraform init` is wrong)
TF_DIR := $(ROOT)/infra/terraform/gcp/envs/dev

tf-init: ## terraform init (envs/dev)
	cd $(TF_DIR) && terraform init

tf-plan: ## terraform plan (envs/dev; inits first)
	cd $(TF_DIR) && terraform init -input=false && terraform plan

tf-apply: ## terraform apply (envs/dev; inits first)
	cd $(TF_DIR) && terraform init -input=false && terraform apply

tf-destroy: ## Destroy Terraform infra + disable Firebase Hosting (keeps GCP project)
ifeq ($(strip $(GCP_PROJECT_ID)),)
	$(error No project set. Put GCP_PROJECT_ID in root .env)
endif
	@echo "Using GCP_PROJECT_ID=$(GCP_PROJECT_ID)"
	$(ROOT)/scripts/destroy_infra.sh

delete-project: ## Delete GCP project + clear local TF state (requires CONFIRM=yes)
ifeq ($(strip $(GCP_PROJECT_ID)),)
	$(error No project set. Put GCP_PROJECT_ID in root .env)
endif
	CONFIRM=$(CONFIRM) $(ROOT)/scripts/delete_project.sh
