output "service_name" {
  description = "Cloud Run サービス名"
  value       = google_cloud_run_v2_service.main.name
}

output "service_uri" {
  description = "Cloud Run サービス URI"
  value       = google_cloud_run_v2_service.main.uri
}

output "service_id" {
  description = "Cloud Run サービス ID"
  value       = google_cloud_run_v2_service.main.id
}
