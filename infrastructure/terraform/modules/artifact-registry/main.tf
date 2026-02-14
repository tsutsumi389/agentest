# Artifact Registry - Docker イメージリポジトリ

resource "google_artifact_registry_repository" "main" {
  repository_id = "${var.prefix}-docker"
  project       = var.project_id
  location      = var.region
  format        = "DOCKER"
  description   = "Agentest Docker images"

  # 古いイメージの自動クリーンアップ
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = var.keep_count
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "${var.untagged_retention_days * 24 * 60 * 60}s"
    }
  }

  labels = {
    managed_by  = "terraform"
    environment = var.environment
  }
}
