# Cloud Run service = HTTPS backend that runs a container.
# Identity: service_account_email (IAM module). Image: from Artifact Registry after deploy.

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Cloud Run region"
  type        = string
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "gcp-chatbot-api"
}

variable "image" {
  description = "Full container image URL (…-docker.pkg.dev/…/api:tag)"
  type        = string
}

variable "service_account_email" {
  description = "Runtime SA email — container calls Firestore/Vertex AS this identity"
  type        = string
}

variable "env_vars" {
  description = "Plain (non-secret) environment variables injected into the container"
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Map of ENV_VAR_NAME => Secret Manager secret_id (mounted as version latest)"
  type        = map(string)
  default     = {}
}

variable "labels" {
  description = "Resource labels for billing attribution"
  type        = map(string)
  default     = {}
}

variable "allow_unauthenticated" {
  description = "If true, anyone on the internet can invoke the URL (SPA API; workers should be false)"
  type        = bool
  default     = true
}

variable "min_instances" {
  description = "0 = scale to zero when idle (cheap for learning)"
  type        = number
  default     = 0
}

variable "max_instances" {
  type    = number
  default = 3
}

variable "timeout" {
  description = "Request timeout (SSE for API; short jobs for worker)"
  type        = string
  default     = "300s"
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "container_command" {
  description = "Optional container entrypoint override (null = image CMD)"
  type        = list(string)
  default     = null
}

variable "container_args" {
  description = "Optional container args override"
  type        = list(string)
  default     = null
}

variable "ingress" {
  description = "Cloud Run ingress setting"
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"
}

resource "google_cloud_run_v2_service" "api" {
  project  = var.project_id
  name     = var.service_name
  location = var.location
  ingress  = var.ingress

  # Allow terraform destroy / make tf-destroy (provider default is true = blocked)
  deletion_protection = false

  labels = var.labels

  template {
    service_account = var.service_account_email
    labels          = var.labels
    timeout         = var.timeout

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      ports {
        container_port = 8080 # must match Dockerfile / uvicorn
      }

      # Optional: same image, different entrypoint (API vs worker).
      # null = image CMD. Cloud Run resolves `command` against a default PATH
      # (not the image ENV PATH), so callers must pass an absolute binary.
      command = var.container_command
      args    = var.container_args

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env_vars
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Who may call the HTTPS URL? allUsers = public (browser SPA without Google login).
resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = var.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "service_uri" {
  description = "HTTPS base URL — set as VITE_API_BASE_URL in frontend/.env"
  value       = google_cloud_run_v2_service.api.uri
}

output "service_name" {
  value = google_cloud_run_v2_service.api.name
}

output "service_id" {
  description = "Full resource id for IAM / Pub/Sub bindings"
  value       = google_cloud_run_v2_service.api.id
}
