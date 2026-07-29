variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "account_id" {
  description = "Service account ID (short name)"
  type        = string
  default     = "gcp-chatbot-run"
}

variable "display_name" {
  description = "Service account display name"
  type        = string
  default     = "Cloud Run runtime for gcp-chatbot"
}

variable "roles" {
  description = "Project-level IAM roles for the runtime service account"
  type        = list(string)
  default = [
    "roles/aiplatform.user",
    "roles/datastore.user",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
  ]
}

# google_service_account has no billing labels attribute.

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.account_id
  display_name = var.display_name
}

resource "google_project_iam_member" "runtime_roles" {
  for_each = toset(var.roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

output "service_account_email" {
  value = google_service_account.runtime.email
}

output "service_account_name" {
  value = google_service_account.runtime.name
}
