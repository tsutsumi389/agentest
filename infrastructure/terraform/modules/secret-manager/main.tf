# Secret Manager - シークレット定義 + IAM
# シークレットの値は Terraform で管理しない（state への平文保存を防止）
# 値は `gcloud secrets versions add` で手動投入

# シークレットリソース定義
resource "google_secret_manager_secret" "secrets" {
  for_each = toset(var.secret_ids)

  secret_id = "${var.prefix}-${var.environment}-${each.value}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    managed_by  = "terraform"
    environment = var.environment
  }
}

# サービスアカウントごとのシークレットアクセス権限
# リソースレベルで個別付与（プロジェクトレベルの広範な権限は付与しない）
resource "google_secret_manager_secret_iam_member" "access" {
  for_each = {
    for binding in local.secret_bindings : "${binding.secret_id}-${binding.sa_email}" => binding
  }

  project   = var.project_id
  secret_id = google_secret_manager_secret.secrets[each.value.secret_id].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.value.sa_email}"
}

locals {
  # シークレットとサービスアカウントの組み合わせを展開
  secret_bindings = flatten([
    for sa_key, secrets in var.secret_access_map : [
      for secret_id in secrets : {
        secret_id = secret_id
        sa_email  = var.service_account_emails[sa_key]
      }
    ]
  ])
}
