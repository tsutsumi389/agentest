variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "prefix" {
  description = "リソース名のプレフィックス"
  type        = string
  default     = "agentest"
}

variable "environment" {
  description = "環境名（staging / production）"
  type        = string
}

variable "secret_ids" {
  description = "管理対象のシークレットID一覧"
  type        = list(string)
  default = [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "INTERNAL_API_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "TOTP_ENCRYPTION_KEY",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_YEARLY",
    "STRIPE_PRICE_TEAM_MONTHLY",
    "STRIPE_PRICE_TEAM_YEARLY",
    "SMTP_USER",
    "SMTP_PASS",
  ]
}

variable "service_account_emails" {
  description = "サービスアカウントのメールアドレスマップ"
  type        = map(string)
}

variable "secret_access_map" {
  description = "サービスアカウントごとにアクセスを許可するシークレットのマッピング"
  type        = map(list(string))
  default = {
    api = [
      "DATABASE_URL",
      "REDIS_URL",
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "INTERNAL_API_SECRET",
      "TOKEN_ENCRYPTION_KEY",
      "TOTP_ENCRYPTION_KEY",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PUBLISHABLE_KEY",
      "STRIPE_PRICE_PRO_MONTHLY",
      "STRIPE_PRICE_PRO_YEARLY",
      "STRIPE_PRICE_TEAM_MONTHLY",
      "STRIPE_PRICE_TEAM_YEARLY",
      "SMTP_USER",
      "SMTP_PASS",
    ]
    ws = [
      "DATABASE_URL",
      "REDIS_URL",
      "JWT_ACCESS_SECRET",
    ]
    mcp = [
      "DATABASE_URL",
      "REDIS_URL",
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "INTERNAL_API_SECRET",
    ]
    jobs = [
      "DATABASE_URL",
      "REDIS_URL",
      "STRIPE_SECRET_KEY",
    ]
  }
}
