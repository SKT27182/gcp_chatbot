# Runtime identity for Cloud Run: a "robot user" (service account) plus IAM roles.
# Cloud Run does not get Firestore/Vertex access by magic — it runs AS this SA,
# and Google checks these roles on every API call.

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "account_id" {
  description = "Service account ID (short name) — becomes account_id@PROJECT.iam.gserviceaccount.com"
  type        = string
  default     = "gcp-chatbot-run"
}

variable "display_name" {
  description = "Human-readable name in GCP Console → IAM"
  type        = string
  default     = "Cloud Run runtime for gcp-chatbot"
}

variable "roles" {
  description = "Project-level IAM roles granted to the runtime service account"
  type        = list(string)
  default = [
    "roles/aiplatform.user",             # Vertex AI / Gemini (LITELLM_MODEL=vertex_ai/*)
    "roles/datastore.user",              # Firestore read/write (chat history)
    "roles/secretmanager.secretAccessor", # Read mounted secrets (e.g. LITELLM_API_KEY)
    "roles/logging.logWriter",           # Send stdout logs to Cloud Logging
  ]
}

# google_service_account has no billing labels attribute.

# Create the robot identity (no permissions yet — roles are attached below).
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.account_id
  display_name = var.display_name
}

# Grant each role on the whole project to this SA (identity-based access).
# Example: datastore.user ⇒ this SA can read/write Firestore in this project.
resource "google_project_iam_member" "runtime_roles" {
  for_each = toset(var.roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

output "service_account_email" {
  description = "Pass this into Cloud Run as service_account so the container runs as this robot"
  value       = google_service_account.runtime.email
}

output "service_account_name" {
  value = google_service_account.runtime.name
}
