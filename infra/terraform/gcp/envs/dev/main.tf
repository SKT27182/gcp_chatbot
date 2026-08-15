# =============================================================================
# Dev environment "director" — enables APIs, then builds chatbot cloud pieces.
#
# Story:
#   1) Turn on Google APIs for this project
#   2) Create Artifact Registry (Docker images) + Cloud Build push IAM
#   3) Create Firestore (chat history)
#   4) Create runtime SAs + roles (API + worker + push invoker)
#   5) Create Secret Manager shells
#   6) Create Cloud Run API + private worker (same image, different CMD)
#   7) Create Pub/Sub topic + OIDC push subscription (+ DLQ)
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

provider "google" {
  project = var.project_id
  region  = var.region

  default_labels = {
    env        = var.environment
    app        = var.app_name
    managed_by = "terraform"
  }
}

locals {
  firestore_location = var.firestore_location != "" ? var.firestore_location : var.region

  apis = [
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "run.googleapis.com",
    "aiplatform.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "pubsub.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "identitytoolkit.googleapis.com",
  ]

  common_labels = {
    env        = var.environment
    app        = var.app_name
    managed_by = "terraform"
  }

  cloud_run_base_env = {
    ENVIRONMENT        = var.environment
    LOG_LEVEL          = "INFO"
    CLOUD_PROVIDER     = "gcp"
    GCP_PROJECT_ID     = var.project_id
    GCP_REGION         = var.region
    FIRESTORE_DATABASE = var.firestore_database
    COST_LABEL_APP     = var.app_name
    CHAT_HISTORY_LIMIT = "20"
    JOBS_ENABLED       = "true"
    PUBSUB_TOPIC       = var.pubsub_topic_id
  }

  # First `make tf-apply` uses Cloud Run's hello placeholder so the service can
  # exist before `make deploy-backend` pushes a real image. Do not override CMD
  # on that image (it has no uvicorn). Cloud Run `command` also ignores image
  # PATH, so the real worker uses the venv binary path.
  placeholder_cloud_run_image = strcontains(var.cloud_run_image, "cloudrun/container/hello")
}

# -----------------------------------------------------------------------------
# 1) Enable APIs
# -----------------------------------------------------------------------------
resource "google_project_service" "apis" {
  for_each = toset(local.apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
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

data "google_project" "current" {
  project_id = var.project_id
}

# Cloud Build (legacy SA + default Compute SA) must push to Artifact Registry.
# New projects often run builds as the Compute SA; older ones use @cloudbuild.
resource "google_artifact_registry_repository_iam_member" "cloudbuild_writer" {
  for_each = toset([
    "serviceAccount:${data.google_project.current.number}@cloudbuild.gserviceaccount.com",
    "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com",
  ])

  project    = var.project_id
  location   = var.region
  repository = module.artifact_registry.repository_id
  role       = "roles/artifactregistry.writer"
  member     = each.value

  depends_on = [
    module.artifact_registry,
    google_project_service.apis,
  ]
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
# 4) Service accounts
# -----------------------------------------------------------------------------
module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id
  account_id = var.runtime_service_account_id
  roles = [
    "roles/aiplatform.user",
    "roles/datastore.user",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
  ]

  depends_on = [google_project_service.apis]
}

module "iam_worker" {
  source = "../../modules/iam"

  project_id   = var.project_id
  account_id   = var.worker_service_account_id
  display_name = "Cloud Run worker for gcp-chatbot"
  roles = [
    "roles/aiplatform.user",
    "roles/datastore.user",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
  ]

  depends_on = [google_project_service.apis]
}

# OIDC identity used by Pub/Sub to invoke the private worker (no project-wide roles)
resource "google_service_account" "pubsub_push" {
  project      = var.project_id
  account_id   = var.pubsub_push_service_account_id
  display_name = "Pub/Sub push invoker for gcp-chatbot worker"

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# 5) Secret Manager shells
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
# 6) Cloud Run API (public invoker; app-level Firebase Auth)
# -----------------------------------------------------------------------------
module "cloud_run" {
  source = "../../modules/cloud_run"

  project_id            = var.project_id
  location              = var.region
  service_name          = var.cloud_run_service
  image                 = var.cloud_run_image
  service_account_email = module.iam.service_account_email
  allow_unauthenticated = var.allow_unauthenticated
  min_instances         = 0
  max_instances         = var.max_instances
  labels = merge(local.common_labels, {
    service = "cloud-run"
  })

  env_vars = merge(local.cloud_run_base_env, var.additional_env_vars)

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

# -----------------------------------------------------------------------------
# 7) Cloud Run worker (private; Pub/Sub OIDC only)
# -----------------------------------------------------------------------------
module "cloud_run_worker" {
  source = "../../modules/cloud_run"

  project_id            = var.project_id
  location              = var.region
  service_name          = var.worker_cloud_run_service
  image                 = var.cloud_run_image
  service_account_email = module.iam_worker.service_account_email
  allow_unauthenticated = false
  min_instances         = 0
  max_instances         = var.worker_max_instances
  timeout               = "120s"
  labels = merge(local.common_labels, {
    service = "cloud-run-worker"
  })

  container_command = local.placeholder_cloud_run_image ? null : ["/app/.venv/bin/uvicorn"]
  container_args = local.placeholder_cloud_run_image ? null : [
    "app.worker.main:app",
    "--host", "0.0.0.0",
    "--port", "8080",
  ]

  env_vars = merge(local.cloud_run_base_env, var.additional_env_vars, {
    APP_NAME = "gcp-chatbot-worker"
  })

  secret_env_vars = {
    LITELLM_API_KEY = "litellm-api-key"
  }

  depends_on = [
    google_project_service.apis,
    module.artifact_registry,
    module.firestore,
    module.iam_worker,
    module.secret_manager,
  ]
}

# Pub/Sub push SA may invoke the worker
resource "google_cloud_run_v2_service_iam_member" "worker_invoker" {
  project  = var.project_id
  location = var.region
  name     = module.cloud_run_worker.service_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_push.email}"
}

# -----------------------------------------------------------------------------
# 8) Pub/Sub topic + push subscription + DLQ
# -----------------------------------------------------------------------------
module "pubsub" {
  source = "../../modules/pubsub"

  project_id                      = var.project_id
  topic_id                        = var.pubsub_topic_id
  dlq_topic_id                    = var.pubsub_dlq_topic_id
  subscription_id                 = var.pubsub_subscription_id
  dlq_subscription_id             = var.pubsub_dlq_subscription_id
  push_endpoint                   = "${module.cloud_run_worker.service_uri}/internal/pubsub/title"
  oidc_audience                   = module.cloud_run_worker.service_uri
  ack_deadline_seconds            = 120
  push_service_account_email      = google_service_account.pubsub_push.email
  publisher_service_account_email = module.iam.service_account_email
  worker_service_account_email    = module.iam_worker.service_account_email
  labels = merge(local.common_labels, {
    service = "pubsub"
  })

  depends_on = [
    google_project_service.apis,
    module.cloud_run_worker,
    google_cloud_run_v2_service_iam_member.worker_invoker,
  ]
}
