output "bucket_name" {
  description = "GCS バケット名"
  value       = google_storage_bucket.main.name
}

output "bucket_url" {
  description = "GCS バケット URL"
  value       = google_storage_bucket.main.url
}
