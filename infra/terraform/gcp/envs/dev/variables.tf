# Inputs for envs/dev — set real values in terraform.tfvars (project_id, …).
# Defaults cover learning/dev; deploy-backend overrides cloud_run_image + additional_env_vars.

variable "project_id" {
  description = "GCP project ID (must match root .env GCP_PROJECT_ID)"
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
  description = "Firestore location_id; empty string ⇒ use var.region"
  type        = string
  default     = ""
}

variable "firestore_database" {
  description = "Must be '(default)' for the default DB (include parentheses)"
  type        = string
  default     = "(default)"
}

variable "artifact_repo" {
  description = "Artifact Registry repository id"
  type        = string
  default     = "gcp-chatbot"
}

variable "runtime_service_account_id" {
  description = "Short SA name for the API Cloud Run service"
  type        = string
  default     = "gcp-chatbot-run"
}

variable "worker_service_account_id" {
  description = "Short SA name for the worker Cloud Run service"
  type        = string
  default     = "gcp-chatbot-worker"
}

variable "pubsub_push_service_account_id" {
  description = "Short SA name used by Pub/Sub OIDC to invoke the worker"
  type        = string
  default     = "gcp-chatbot-pubsub-push"
}

variable "cloud_run_service" {
  description = "API Cloud Run service name"
  type        = string
  default     = "gcp-chatbot-api"
}

variable "worker_cloud_run_service" {
  description = "Worker Cloud Run service name"
  type        = string
  default     = "gcp-chatbot-worker"
}

variable "cloud_run_image" {
  description = "Container image URL (set by make deploy-backend) — shared by API + worker. Default is Cloud Run's hello placeholder so first make tf-apply can create the services before a real image exists."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "additional_env_vars" {
  description = "App env from root .env (LITELLM_MODEL, GCP_LOCATION, …) injected on deploy"
  type        = map(string)
  default     = {}
}

variable "allow_unauthenticated" {
  description = "Public Cloud Run invoker for the API (Phase-1 learning)"
  type        = bool
  default     = true
}

variable "max_instances" {
  type    = number
  default = 3
}

variable "worker_max_instances" {
  type    = number
  default = 3
}

variable "secret_ids" {
  description = "Secret Manager IDs to create (real values via make push-secrets)"
  type        = set(string)
  default     = ["litellm-api-key"]
}

variable "pubsub_topic_id" {
  description = "Pub/Sub topic for async jobs"
  type        = string
  default     = "chat-jobs"
}

variable "pubsub_dlq_topic_id" {
  description = "Dead-letter topic for failed job deliveries"
  type        = string
  default     = "chat-jobs-dlq"
}

variable "pubsub_subscription_id" {
  description = "Push subscription that invokes the worker"
  type        = string
  default     = "chat-jobs-worker"
}

variable "pubsub_dlq_subscription_id" {
  description = "Pull subscription on the DLQ for inspection"
  type        = string
  default     = "chat-jobs-dlq-pull"
}
