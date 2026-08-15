# Values printed after terraform apply / make show-outputs helpers.

output "artifact_registry_url" {
  description = "Docker repo base URL (deploy scripts also reconstruct this)"
  value       = module.artifact_registry.repository_url
}

output "cloud_run_url" {
  description = "Backend HTTPS URL — set as VITE_API_BASE_URL in frontend/.env"
  value       = module.cloud_run.service_uri
}

output "worker_cloud_run_url" {
  description = "Private worker HTTPS URL (Pub/Sub push target; not for browsers)"
  value       = module.cloud_run_worker.service_uri
}

output "runtime_service_account" {
  description = "API Cloud Run robot identity"
  value       = module.iam.service_account_email
}

output "worker_service_account" {
  description = "Worker Cloud Run robot identity"
  value       = module.iam_worker.service_account_email
}

output "pubsub_push_service_account" {
  description = "OIDC SA used by Pub/Sub to invoke the worker"
  value       = google_service_account.pubsub_push.email
}

output "firestore_database" {
  description = "Firestore database name (usually (default))"
  value       = module.firestore.database_name
}

output "secret_ids" {
  description = "Secret Manager ids created (push real values with make push-secrets if needed)"
  value       = module.secret_manager.secret_ids
}

output "pubsub_topic" {
  description = "Pub/Sub topic id for title jobs"
  value       = module.pubsub.topic_id
}

output "pubsub_subscription" {
  description = "Push subscription id"
  value       = module.pubsub.subscription_id
}

output "pubsub_dlq_topic" {
  description = "Dead-letter topic id"
  value       = module.pubsub.dlq_topic_id
}

output "pubsub_push_endpoint" {
  description = "Worker push endpoint path"
  value       = module.pubsub.push_endpoint
}
