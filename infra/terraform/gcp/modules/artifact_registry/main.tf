# Private Docker image registry for the backend container.
# make deploy-backend builds/pushes here; Cloud Run pulls the image from this repo.

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Artifact Registry location (usually same as Cloud Run region)"
  type        = string
}

variable "repository_id" {
  description = "Repository name — appears in image URL as …/REPOSITORY_ID/api:tag"
  type        = string
  default     = "gcp-chatbot"
}

variable "description" {
  description = "Repository description"
  type        = string
  default     = "Docker images for gcp-chatbot backend"
}

variable "labels" {
  description = "Resource labels for billing attribution (e.g. env, app, service)"
  type        = map(string)
  default     = {}
}

resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.location
  repository_id = var.repository_id
  description   = var.description
  format        = "DOCKER" # container images (not Maven/npm/etc.)
  labels        = var.labels
}

output "repository_id" {
  value = google_artifact_registry_repository.docker.repository_id
}

# Full path used when tagging/pushing: LOCATION-docker.pkg.dev/PROJECT/REPO
output "repository_url" {
  value = "${var.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}
