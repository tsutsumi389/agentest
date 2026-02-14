# Cloud Run Job + Cloud Scheduler

# Cloud Run Job 定義
resource "google_cloud_run_v2_job" "main" {
  name     = "${var.prefix}-jobs-${var.environment}"
  project  = var.project_id
  location = var.region

  template {
    template {
      service_account = var.service_account_email
      timeout         = var.job_timeout

      # VPC コネクタ設定
      dynamic "vpc_access" {
        for_each = var.vpc_connector_id != null ? [1] : []

        content {
          connector = var.vpc_connector_id
          egress    = "PRIVATE_RANGES_ONLY"
        }
      }

      containers {
        image = var.image

        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }

        # 共通環境変数
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

      max_retries = var.max_retries
    }

    task_count = 1
  }

  labels = {
    managed_by  = "terraform"
    environment = var.environment
  }
}

# Cloud Scheduler ジョブ（for_each で展開）
resource "google_cloud_scheduler_job" "schedules" {
  for_each = var.schedules

  name     = "${var.prefix}-${each.key}-${var.environment}"
  project  = var.project_id
  region   = var.region
  schedule = each.value.cron

  time_zone   = "Asia/Tokyo"
  description = each.value.description

  retry_config {
    retry_count          = 1
    min_backoff_duration = "5s"
    max_backoff_duration = "60s"
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.main.name}:run"

    body = base64encode(jsonencode({
      overrides = {
        containerOverrides = [{
          env = [{
            name  = "JOB_NAME"
            value = each.value.job_name
          }]
        }]
      }
    }))

    headers = {
      "Content-Type" = "application/json"
    }

    oauth_token {
      service_account_email = var.scheduler_service_account_email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}
