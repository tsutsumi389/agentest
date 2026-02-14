# Cloud Run Service（汎用モジュール）
# API, WS, MCP, Web, Admin の5サービスで再利用

resource "google_cloud_run_v2_service" "main" {
  name     = "${var.prefix}-${var.service_name}"
  project  = var.project_id
  location = var.region
  ingress  = var.ingress

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    # VPC コネクタ設定（バックエンドサービスのみ）
    dynamic "vpc_access" {
      for_each = var.vpc_connector_id != null ? [1] : []

      content {
        connector = var.vpc_connector_id
        egress    = "PRIVATE_RANGES_ONLY"
      }
    }

    # セッションアフィニティ（WebSocket 用）
    session_affinity = var.session_affinity

    containers {
      image = var.image

      ports {
        container_port = var.port
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = var.cpu_idle
        startup_cpu_boost = var.startup_cpu_boost
      }

      # 環境変数
      dynamic "env" {
        for_each = var.env_vars

        content {
          name  = env.key
          value = env.value
        }
      }

      # Secret Manager からのシークレット注入
      dynamic "env" {
        for_each = var.secret_env_vars

        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      # ヘルスチェック: startup probe
      startup_probe {
        http_get {
          path = var.health_check_path
          port = var.port
        }
        initial_delay_seconds = var.startup_probe_initial_delay
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 3
      }

      # ヘルスチェック: liveness probe
      liveness_probe {
        http_get {
          path = var.health_check_path
          port = var.port
        }
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3
      }
    }

    timeout = var.timeout

    labels = {
      managed_by  = "terraform"
      environment = var.environment
      service     = var.service_name
    }
  }

  labels = {
    managed_by  = "terraform"
    environment = var.environment
  }
}

# 未認証アクセスの許可（パブリックサービスの場合）
resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
