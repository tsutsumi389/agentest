# Cloud Storage (GCS) - MinIO 代替

resource "google_storage_bucket" "main" {
  name     = "${var.prefix}-storage-${var.environment}"
  project  = var.project_id
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = var.environment == "staging"

  versioning {
    enabled = var.versioning_enabled
  }

  # ライフサイクルルール: 古いバージョンの自動削除
  dynamic "lifecycle_rule" {
    for_each = var.versioning_enabled ? [1] : []

    content {
      condition {
        num_newer_versions = 3
      }
      action {
        type = "Delete"
      }
    }
  }

  cors {
    origin          = var.cors_origins
    method          = ["GET", "PUT", "POST", "DELETE"]
    response_header = ["Content-Type", "Content-Disposition"]
    max_age_seconds = 3600
  }

  labels = {
    managed_by  = "terraform"
    environment = var.environment
  }
}
