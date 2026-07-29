variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "environment" {
  description = "Billing/resource label env (e.g. dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "app_name" {
  description = "Billing/resource label app — filter Billing by labels.app"
  type        = string
  default     = "chatbot"
}

variable "region" {
  description = "Primary region for Cloud Run and Artifact Registry"
  type        = string
  default     = "asia-south1"
}

variable "firestore_location" {
  description = "Firestore location_id (defaults to region)"
  type        = string
  default     = ""
}

variable "firestore_database" {
  type    = string
  default = "(default)"
}

variable "artifact_repo" {
  type    = string
  default = "gcp-chatbot"
}

variable "runtime_service_account_id" {
  type    = string
  default = "gcp-chatbot-run"
}

variable "cloud_run_service" {
  type    = string
  default = "gcp-chatbot-api"
}

variable "cloud_run_image" {
  description = "Container image URL (set by make deploy-backend)"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "additional_env_vars" {
  description = "App env from root .env (LITELLM_MODEL, GCP_LOCATION, …) injected on deploy"
  type        = map(string)
  default     = {}
}

variable "allow_unauthenticated" {
  type    = bool
  default = true
}

variable "max_instances" {
  type    = number
  default = 3
}

variable "secret_ids" {
  description = "Secret Manager IDs to create (real values via make push-secrets)"
  type        = set(string)
  default     = ["litellm-api-key"]
}
