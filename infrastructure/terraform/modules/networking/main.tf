# VPC、サブネット、Private Service Access、サーバーレスVPCコネクタ

# VPC
resource "google_compute_network" "main" {
  name                    = "${var.prefix}-vpc"
  project                 = var.project_id
  auto_create_subnetworks = false
}

# メインサブネット
resource "google_compute_subnetwork" "main" {
  name          = "${var.prefix}-subnet"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = var.subnet_cidr

  private_ip_google_access = true
}

# Private Service Access 用 IP アドレス範囲（Cloud SQL / Redis 向け）
resource "google_compute_global_address" "private_service_access" {
  name          = "${var.prefix}-private-service-access"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

# Private Service Access 接続
resource "google_service_networking_connection" "private_service_access" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_access.name]
}

# Private Service Access の反映を待機（GCP 側の伝播遅延対策）
resource "time_sleep" "wait_for_private_service_access" {
  depends_on      = [google_service_networking_connection.private_service_access]
  create_duration = "60s"
}

# サーバーレス VPC コネクタ（Cloud Run → VPC 内リソース接続用）
resource "google_vpc_access_connector" "main" {
  name          = "${var.prefix}-connector"
  project       = var.project_id
  region        = var.region
  ip_cidr_range = var.connector_cidr
  network       = google_compute_network.main.name
  machine_type  = var.connector_machine_type

  min_instances = var.connector_min_instances
  max_instances = var.connector_max_instances
}
