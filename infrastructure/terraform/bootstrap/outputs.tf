output "tfstate_bucket" {
  description = "Terraform state を保存する GCS バケット名"
  value       = google_storage_bucket.tfstate.name
}
