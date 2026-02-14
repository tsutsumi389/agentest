# Memorystore (Redis 7) - Private Service Access 経由

resource "google_redis_instance" "main" {
  name           = "${var.prefix}-redis-${var.environment}"
  project        = var.project_id
  region         = var.region
  tier           = var.tier
  memory_size_gb = var.memory_size_gb
  redis_version  = "REDIS_7_0"

  authorized_network = var.network_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  labels = {
    managed_by  = "terraform"
    environment = var.environment
  }

  # Private Service Access が完了してから作成する
  # 依存関係は private_service_access_connection 変数を通じて暗黙的に解決
}
