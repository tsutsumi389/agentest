output "network_id" {
  description = "VPC ネットワーク ID"
  value       = google_compute_network.main.id
}

output "network_name" {
  description = "VPC ネットワーク名"
  value       = google_compute_network.main.name
}

output "network_self_link" {
  description = "VPC ネットワークの self_link"
  value       = google_compute_network.main.self_link
}

output "subnet_id" {
  description = "サブネット ID"
  value       = google_compute_subnetwork.main.id
}

output "vpc_connector_id" {
  description = "VPC コネクタ ID"
  value       = google_vpc_access_connector.main.id
}

output "private_service_access_connection" {
  description = "Private Service Access 接続（time_sleep 経由で伝播待機済み）"
  value       = time_sleep.wait_for_private_service_access.id
}
