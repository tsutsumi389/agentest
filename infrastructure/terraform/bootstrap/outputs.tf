output "tfstate_bucket" {
  description = "Terraform state を保存する GCS バケット名"
  value       = google_storage_bucket.tfstate.name
}

output "docker_registry" {
  description = "Artifact Registry リポジトリ名"
  value       = google_artifact_registry_repository.docker.name
}
