# Pub/Sub topic + authenticated push subscription (+ DLQ) for async title jobs.

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "topic_id" {
  description = "Primary Pub/Sub topic id"
  type        = string
  default     = "chat-jobs"
}

variable "dlq_topic_id" {
  description = "Dead-letter topic id"
  type        = string
  default     = "chat-jobs-dlq"
}

variable "subscription_id" {
  description = "Push subscription id"
  type        = string
  default     = "chat-jobs-worker"
}

variable "dlq_subscription_id" {
  description = "Pull subscription on DLQ for inspection / replay"
  type        = string
  default     = "chat-jobs-dlq-pull"
}

variable "push_endpoint" {
  description = "HTTPS push endpoint (Cloud Run worker /internal/pubsub/title)"
  type        = string
}

variable "push_service_account_email" {
  description = "OIDC SA used by Pub/Sub to invoke the worker"
  type        = string
}

variable "publisher_service_account_email" {
  description = "API runtime SA — granted publisher on the topic"
  type        = string
}

variable "worker_service_account_email" {
  description = "Worker runtime SA — subscriber on DLQ pull (optional ops)"
  type        = string
}

variable "oidc_audience" {
  description = "OIDC token audience — Cloud Run service URI (no path)"
  type        = string
}

variable "ack_deadline_seconds" {
  description = "Push ack deadline; match worker timeout and job lease (120s)"
  type        = number
  default     = 120
}

variable "max_delivery_attempts" {
  type    = number
  default = 5
}

variable "labels" {
  description = "Resource labels for billing attribution"
  type        = map(string)
  default     = {}
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_pubsub_topic" "jobs" {
  project = var.project_id
  name    = var.topic_id
  labels  = var.labels
}

resource "google_pubsub_topic" "dlq" {
  project = var.project_id
  name    = var.dlq_topic_id
  labels  = var.labels
}

resource "google_pubsub_subscription" "worker_push" {
  project = var.project_id
  name    = var.subscription_id
  topic   = google_pubsub_topic.jobs.id
  labels  = var.labels

  ack_deadline_seconds = var.ack_deadline_seconds

  push_config {
    push_endpoint = var.push_endpoint

    oidc_token {
      service_account_email = var.push_service_account_email
      # Cloud Run IAM checks aud against the service URI, not the path.
      audience = var.oidc_audience
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq.id
    max_delivery_attempts = var.max_delivery_attempts
  }

  expiration_policy {
    ttl = "" # never expire
  }
}

resource "google_pubsub_subscription" "dlq_pull" {
  project              = var.project_id
  name                 = var.dlq_subscription_id
  topic                = google_pubsub_topic.dlq.id
  labels               = var.labels
  ack_deadline_seconds = 60

  expiration_policy {
    ttl = ""
  }
}

# API publishes jobs
resource "google_pubsub_topic_iam_member" "api_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.jobs.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${var.publisher_service_account_email}"
}

# Pub/Sub service agent needs permission to publish to DLQ and to mint OIDC tokens
resource "google_pubsub_topic_iam_member" "pubsub_dlq_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.dlq.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription_iam_member" "pubsub_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.worker_push.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_service_account_iam_member" "pubsub_token_creator" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${var.push_service_account_email}"
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# Worker can pull DLQ for ops/debug
resource "google_pubsub_subscription_iam_member" "worker_dlq_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.dlq_pull.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:${var.worker_service_account_email}"
}

output "topic_id" {
  value = google_pubsub_topic.jobs.name
}

output "topic_name" {
  value = google_pubsub_topic.jobs.id
}

output "subscription_id" {
  value = google_pubsub_subscription.worker_push.name
}

output "dlq_topic_id" {
  value = google_pubsub_topic.dlq.name
}

output "dlq_subscription_id" {
  value = google_pubsub_subscription.dlq_pull.name
}

output "push_endpoint" {
  value = var.push_endpoint
}
