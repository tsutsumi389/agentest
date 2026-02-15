# Cloud SQL (PostgreSQL 16) - プライベートIPのみ

resource "google_sql_database_instance" "main" {
  name             = "${var.prefix}-db-${var.environment}"
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_16"

  deletion_protection = var.deletion_protection

  # Private Service Access が完了してから作成する（変数経由の暗黙的依存）

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    disk_size         = var.disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      location                       = var.region
      point_in_time_recovery_enabled = var.pitr_enabled
      transaction_log_retention_days = var.pitr_enabled ? 7 : null

      backup_retention_settings {
        retained_backups = var.backup_retained_count
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7 # 日曜日
      hour         = 3 # 03:00 UTC（JST 12:00）
      update_track = "stable"
    }

    database_flags {
      name  = "max_connections"
      value = var.max_connections
    }

    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }

    user_labels = {
      managed_by  = "terraform"
      environment = var.environment
    }
  }
}

# データベース作成
resource "google_sql_database" "main" {
  name     = var.database_name
  project  = var.project_id
  instance = google_sql_database_instance.main.name
}

# データベースユーザー作成（パスワードは Secret Manager で管理）
resource "google_sql_user" "main" {
  name     = var.database_user
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  password = var.database_password
}
