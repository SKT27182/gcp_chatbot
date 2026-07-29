# Values printed after terraform apply / make show-outputs helpers.

output "artifact_registry_url" {
  description = "Docker repo base URL (deploy scripts also reconstruct this)"
  value       = module.artifact_registry.repository_url
}

output "cloud_run_url" {
  description = "Backend HTTPS URL — set as VITE_API_BASE_URL in frontend/.env"
  value       = module.cloud_run.service_uri
}

output "runtime_service_account" {
  description = "Cloud Run robot identity (has datastore.user, aiplatform.user, …)"
  value       = module.iam.service_account_email
}

output "firestore_database" {
  description = "Firestore database name (usually (default))"
  value       = module.firestore.database_name
}

output "secret_ids" {
  description = "Secret Manager ids created (push real values with make push-secrets if needed)"
  value       = module.secret_manager.secret_ids
}
