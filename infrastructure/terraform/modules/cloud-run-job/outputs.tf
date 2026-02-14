output "job_name" {
  description = "Cloud Run Job 名"
  value       = google_cloud_run_v2_job.main.name
}

output "job_id" {
  description = "Cloud Run Job ID"
  value       = google_cloud_run_v2_job.main.id
}

output "scheduler_job_names" {
  description = "Cloud Scheduler ジョブ名マップ"
  value = {
    for key, job in google_cloud_scheduler_job.schedules : key => job.name
  }
}
