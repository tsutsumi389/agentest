output "repository_id" {
  description = "リポジトリ ID"
  value       = google_artifact_registry_repository.main.repository_id
}

output "repository_url" {
  description = "Docker イメージプッシュ先 URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}
