# =============================================================================
# Dev environment "director" — enables APIs, then builds chatbot cloud pieces.
#
# Story:
#   1) Turn on Google APIs for this project
#   2) Create Artifact Registry (Docker images)
#   3) Create Firestore (chat history)
#   4) Create runtime SA + roles (Firestore/Vertex/secrets/logs access)
#   5) Create Secret Manager shells
#   6) Create Cloud Run (runs FastAPI AS that SA, pulls image, sets env)
#
# Firebase Hosting (React) is NOT here — use make deploy-frontend (Firebase CLI).
# App knobs like LITELLM_MODEL come from root .env via additional_env_vars on deploy.
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

# All resources below are created in this project/region by default.
provider "google" {
  project = var.project_id
  region  = var.region

  # Applied to labelable resources unless overridden (Billing filters)
  default_labels = {
    env        = var.environment
    app        = var.app_name
    managed_by = "terraform"
  }
}

locals {
  # If firestore_location is empty, use the same region as Cloud Run / AR
  firestore_location = var.firestore_location != "" ? var.firestore_location : var.region

  # Products that must be enabled before we can create resources
  apis = [
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "run.googleapis.com",              # Cloud Run
    "aiplatform.googleapis.com",       # Vertex AI / Gemini
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "firebase.googleapis.com",         # for Firebase CLI linking / Hosting APIs
    "firebasehosting.googleapis.com",
  ]

  common_labels = {
    env        = var.environment
    app        = var.app_name
    managed_by = "terraform"
  }

  # Always set on Cloud Run (infra-owned). Merged with additional_env_vars from deploy.
  cloud_run_base_env = {
    ENVIRONMENT        = var.environment
    LOG_LEVEL          = "INFO"
    CLOUD_PROVIDER     = "gcp"
    GCP_PROJECT_ID     = var.project_id
    GCP_REGION         = var.region
    FIRESTORE_DATABASE = var.firestore_database # keep "(default)" including parentheses
    COST_LABEL_APP     = var.app_name
    CHAT_HISTORY_LIMIT = "20"
  }
}

# -----------------------------------------------------------------------------
# 1) Enable APIs (project-level switches)
# -----------------------------------------------------------------------------
resource "google_project_service" "apis" {
  for_each = toset(local.apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false # don't turn APIs off on terraform destroy
}

# -----------------------------------------------------------------------------
# 2) Docker image repository
# -----------------------------------------------------------------------------
module "artifact_registry" {
  source = "../../modules/artifact_registry"

  project_id    = var.project_id
  location      = var.region
  repository_id = var.artifact_repo
  labels = merge(local.common_labels, {
    service = "artifact-registry"
  })

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# 3) Firestore database for chat history
# -----------------------------------------------------------------------------
module "firestore" {
  source = "../../modules/firestore"

  project_id  = var.project_id
  location    = local.firestore_location
  database_id = var.firestore_database

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# 4) Runtime service account + IAM roles (Firestore / Vertex / secrets / logs)
# -----------------------------------------------------------------------------
module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id
  account_id = var.runtime_service_account_id

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# 5) Secret Manager shells (real key values: make push-secrets if not Vertex-only)
# -----------------------------------------------------------------------------
module "secret_manager" {
  source = "../../modules/secret_manager"

  project_id = var.project_id
  secret_ids = var.secret_ids
  labels = merge(local.common_labels, {
    service = "secret-manager"
  })

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# 6) Cloud Run API — runs as IAM SA; image updated by make deploy-backend
# -----------------------------------------------------------------------------
module "cloud_run" {
  source = "../../modules/cloud_run"

  project_id            = var.project_id
  location              = var.region
  service_name          = var.cloud_run_service
  image                 = var.cloud_run_image
  # Container identity = robot with datastore.user / aiplatform.user / …
  service_account_email = module.iam.service_account_email
  allow_unauthenticated = var.allow_unauthenticated
  min_instances         = 0
  max_instances         = var.max_instances
  labels = merge(local.common_labels, {
    service = "cloud-run"
  })

  # Infra env + deploy-time app env (LITELLM_MODEL, GCP_LOCATION, … from root .env)
  env_vars = merge(local.cloud_run_base_env, var.additional_env_vars)

  # Mount secret as process env LITELLM_API_KEY (optional for vertex_ai/*)
  secret_env_vars = {
    LITELLM_API_KEY = "litellm-api-key"
  }

  depends_on = [
    google_project_service.apis,
    module.artifact_registry,
    module.firestore,
    module.iam,
    module.secret_manager,
  ]
}
