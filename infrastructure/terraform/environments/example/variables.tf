variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "region" {
  description = "GCPリージョン"
  type        = string
  default     = "asia-northeast1"
}

variable "environment" {
  description = "環境名"
  type        = string
  default     = "production"
}

variable "prefix" {
  description = "リソース名のプレフィックス"
  type        = string
  default     = "agentest"
}

# --- ドメイン設定 ---
variable "app_domain" {
  description = "アプリケーション用ドメイン（例: app.example.com）"
  type        = string
}

variable "admin_domain" {
  description = "管理画面用ドメイン（例: admin.example.com）"
  type        = string
}

# --- データベース ---
variable "database_password" {
  description = "Cloud SQL データベースパスワード"
  type        = string
  sensitive   = true
}

# --- Docker イメージ ---
variable "api_image" {
  description = "API サービスの Docker イメージ"
  type        = string
}

variable "ws_image" {
  description = "WebSocket サービスの Docker イメージ"
  type        = string
}

variable "mcp_image" {
  description = "MCP サービスの Docker イメージ"
  type        = string
}

variable "web_image" {
  description = "Web フロントエンドの Docker イメージ"
  type        = string
}

variable "admin_image" {
  description = "Admin フロントエンドの Docker イメージ"
  type        = string
}

variable "jobs_image" {
  description = "バッチジョブの Docker イメージ"
  type        = string
}

# --- アプリケーション設定 ---
variable "require_email_verification" {
  description = "メール認証を必須にするか（'true' / 'false'）。SMTP 未設定の場合は 'false' を推奨"
  type        = string
  default     = "true"

  validation {
    condition     = contains(["true", "false"], var.require_email_verification)
    error_message = "require_email_verification は 'true' または 'false' を指定してください"
  }
}

variable "smtp_host" {
  description = "SMTP サーバーホスト（空の場合メール送信無効）"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP サーバーポート"
  type        = number
  default     = 587
}

variable "smtp_from" {
  description = "送信元メールアドレス"
  type        = string
  default     = "noreply@agentest.local"
}

variable "smtp_secure" {
  description = "SMTP で TLS を使用するか（'true' / 'false'）"
  type        = string
  default     = "true"

  validation {
    condition     = contains(["true", "false"], var.smtp_secure)
    error_message = "smtp_secure は 'true' または 'false' を指定してください"
  }
}
