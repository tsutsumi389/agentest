output "host" {
  description = "Redis ホスト"
  value       = google_redis_instance.main.host
}

output "port" {
  description = "Redis ポート"
  value       = google_redis_instance.main.port
}

output "auth_string" {
  description = "Redis 認証文字列"
  value       = google_redis_instance.main.auth_string
  sensitive   = true
}
