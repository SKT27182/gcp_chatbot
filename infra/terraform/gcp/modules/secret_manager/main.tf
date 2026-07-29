# Secret Manager "boxes" for API keys (e.g. LITELLM_API_KEY for gemini/* models).
# Terraform only creates the secret + a placeholder version — real values via make push-secrets.
# Vertex (vertex_ai/*) uses the Cloud Run SA (ADC), not this key.

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

# Create the secret container (metadata only — not the real key string yet).
resource "google_secret_manager_secret" "app" {
  for_each = var.secret_ids

  project   = var.project_id
  secret_id = each.value
  labels    = var.labels

  replication {
    auto {} # Google manages multi-region replication
  }
}

# Placeholder version so Cloud Run can reference version "latest" before you push a real key.
# Keeps the real API key out of Terraform state as much as possible (push via gcloud/CLI).
resource "google_secret_manager_secret_version" "placeholder" {
  for_each = var.secret_ids

  secret      = google_secret_manager_secret.app[each.value].id
  secret_data = "placeholder-replace-me"
}

output "secret_ids" {
  value = { for key, secret in google_secret_manager_secret.app : key => secret.secret_id }
}
