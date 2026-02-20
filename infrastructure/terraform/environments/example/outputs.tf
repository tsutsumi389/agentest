output "lb_ip_address" {
  description = "ロードバランサーの外部 IP アドレス（DNS に設定する A レコード）"
  value       = module.load_balancer.lb_ip_address
}

output "cloud_sql_private_ip" {
  description = "Cloud SQL プライベート IP アドレス"
  value       = module.cloud_sql.private_ip_address
}

output "redis_host" {
  description = "Redis ホスト"
  value       = module.memorystore.host
}

output "artifact_registry_url" {
  description = "Docker イメージプッシュ先 URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${data.google_artifact_registry_repository.docker.repository_id}"
}

output "storage_bucket" {
  description = "GCS バケット名"
  value       = module.cloud_storage.bucket_name
}

output "service_account_emails" {
  description = "サービスアカウントのメールアドレス"
  value       = module.iam.service_account_emails
}

output "cloud_run_uris" {
  description = "Cloud Run サービスの URI"
  value = {
    api   = module.cloud_run_api.service_uri
    ws    = module.cloud_run_ws.service_uri
    mcp   = module.cloud_run_mcp.service_uri
    web   = module.cloud_run_web.service_uri
    admin = module.cloud_run_admin.service_uri
  }
}
