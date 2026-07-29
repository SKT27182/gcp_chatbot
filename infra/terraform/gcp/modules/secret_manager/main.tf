variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "secret_ids" {
  description = "Secret Manager secret IDs to create (values pushed later via make push-secrets)"
  type        = set(string)
  default     = ["litellm-api-key"]
}

variable "labels" {
  description = "Resource labels for billing attribution"
  type        = map(string)
  default     = {}
}

resource "google_secret_manager_secret" "app" {
  for_each = var.secret_ids

  project   = var.project_id
  secret_id = each.value
  labels    = var.labels

  replication {
    auto {}
  }
}

# Placeholder only — real values come from `make push-secrets` (keeps keys out of TF state as much as possible).
resource "google_secret_manager_secret_version" "placeholder" {
  for_each = var.secret_ids

  secret      = google_secret_manager_secret.app[each.value].id
  secret_data = "placeholder-replace-me"
}

output "secret_ids" {
  value = { for key, secret in google_secret_manager_secret.app : key => secret.secret_id }
}
