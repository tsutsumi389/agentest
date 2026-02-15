output "job_name" {
  description = "Cloud Run Migration Job 名"
  value       = google_cloud_run_v2_job.migration.name
}

output "job_id" {
  description = "Cloud Run Migration Job ID"
  value       = google_cloud_run_v2_job.migration.id
}
