# Cloud Run Job - DB マイグレーション用
# デプロイ時に `gcloud run jobs execute` で手動実行する
# スケジューラは不要（デプロイパイプラインから都度実行）

resource "google_cloud_run_v2_job" "migration" {
  name     = "${var.prefix}-db-migrate-${var.environment}"
  project  = var.project_id
  location = var.region

  template {
    template {
      service_account = var.service_account_email
      timeout         = var.timeout

      # VPC コネクタ設定（Cloud SQL プライベート IP への接続に必要）
      dynamic "vpc_access" {
        for_each = var.vpc_connector_id != null ? [1] : []

        content {
          connector = var.vpc_connector_id
          egress    = "PRIVATE_RANGES_ONLY"
        }
      }

      containers {
        image   = var.image
        command = ["npx"]
        args    = ["prisma", "migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"]

        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
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
      }

      # マイグレーションは自動リトライしない（失敗時は原因調査が必要）
      max_retries = 0
    }

    task_count = 1
  }

  labels = {
    managed_by  = "terraform"
    environment = var.environment
    purpose     = "db-migration"
  }
}
