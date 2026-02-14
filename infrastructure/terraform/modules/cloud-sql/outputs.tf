output "instance_name" {
  description = "Cloud SQL インスタンス名"
  value       = google_sql_database_instance.main.name
}

output "instance_connection_name" {
  description = "Cloud SQL 接続名（project:region:instance）"
  value       = google_sql_database_instance.main.connection_name
}

output "private_ip_address" {
  description = "Cloud SQL プライベート IP アドレス"
  value       = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  description = "データベース名"
  value       = google_sql_database.main.name
}

output "database_user" {
  description = "データベースユーザー名"
  value       = google_sql_user.main.name
}
