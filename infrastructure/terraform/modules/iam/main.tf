# サービスアカウント + 最小権限 IAM バインディング

# サービスアカウント定義
resource "google_service_account" "services" {
  for_each = var.service_accounts

  account_id   = "${var.prefix}-${each.key}"
  display_name = each.value.display_name
  project      = var.project_id
}

# プロジェクトレベル IAM バインディング
resource "google_project_iam_member" "service_roles" {
  for_each = {
    for binding in local.iam_bindings : "${binding.sa_key}-${binding.role}" => binding
  }

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.services[each.value.sa_key].email}"
}

locals {
  # サービスアカウントとロールの組み合わせを展開
  iam_bindings = flatten([
    for sa_key, sa_config in var.service_accounts : [
      for role in sa_config.roles : {
        sa_key = sa_key
        role   = role
      }
    ]
  ])
}
