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

  # Enabled by Terraform. Firebase Hosting deploy stays CLI-only.
  apis = [
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "run.googleapis.com",
    "aiplatform.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
  ]

  common_labels = {
    env        = var.environment
    app        = var.app_name
    managed_by = "terraform"
  }

  # Infra-owned env. App knobs come via additional_env_vars from root .env on deploy.
  cloud_run_base_env = {
    ENVIRONMENT        = var.environment
    LOG_LEVEL          = "INFO"
    CLOUD_PROVIDER     = "gcp"
    GCP_PROJECT_ID     = var.project_id
    GCP_REGION         = var.region
    FIRESTORE_DATABASE = var.firestore_database
    COST_LABEL_APP     = var.app_name
    CHAT_HISTORY_LIMIT = "20"
  }
}

resource "google_project_service" "apis" {
  for_each = toset(local.apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

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

module "firestore" {
  source = "../../modules/firestore"

  project_id  = var.project_id
  location    = local.firestore_location
  database_id = var.firestore_database

  depends_on = [google_project_service.apis]
}

module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id
  account_id = var.runtime_service_account_id

  depends_on = [google_project_service.apis]
}

module "secret_manager" {
  source = "../../modules/secret_manager"

  project_id = var.project_id
  secret_ids = var.secret_ids
  labels = merge(local.common_labels, {
    service = "secret-manager"
  })

  depends_on = [google_project_service.apis]
}

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

  # Mount Secret Manager → process env
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
