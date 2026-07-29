# Firestore Native database for chat session history.
# The FastAPI app reads/writes via the Cloud Run service account (roles/datastore.user).

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Firestore location (e.g. asia-south1). Use nam5/eur3 for multi-region."
  type        = string
}

variable "database_id" {
  description = "Firestore database ID. '(default)' is GCP's special default DB name — keep the parentheses."
  type        = string
  default     = "(default)"
}

# Note: google_firestore_database supports Resource Manager `tags` (tagKeys/…),
# not simple billing labels. Cost attribution for Firestore in a shared project
# is limited unless you use a dedicated database / project.

resource "google_firestore_database" "chat" {
  project     = var.project_id
  name        = var.database_id
  location_id = var.location
  type        = "FIRESTORE_NATIVE" # document DB (not Datastore mode)

  # Allow terraform destroy / make tf-destroy to remove this DB
  delete_protection_state = "DELETE_PROTECTION_DISABLED"
  deletion_policy         = "DELETE"
}

output "database_name" {
  value = google_firestore_database.chat.name
}

output "database_id" {
  value = google_firestore_database.chat.name
}
