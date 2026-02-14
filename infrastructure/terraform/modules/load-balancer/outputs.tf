output "lb_ip_address" {
  description = "ロードバランサーの外部 IP アドレス"
  value       = google_compute_global_address.main.address
}

output "security_policy_id" {
  description = "Cloud Armor セキュリティポリシー ID"
  value       = google_compute_security_policy.main.id
}

output "security_policy_self_link" {
  description = "Cloud Armor セキュリティポリシーの self_link"
  value       = google_compute_security_policy.main.self_link
}
