output "artifact_registry_url" {
  value = module.artifact_registry.repository_url
}

output "cloud_run_url" {
  value = module.cloud_run.service_uri
}

output "runtime_service_account" {
  value = module.iam.service_account_email
}

output "firestore_database" {
  value = module.firestore.database_name
}

output "secret_ids" {
  value = module.secret_manager.secret_ids
}
