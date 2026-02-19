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
