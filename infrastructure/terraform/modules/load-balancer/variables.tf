variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "region" {
  description = "GCPリージョン"
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

variable "app_domains" {
  description = "アプリケーション用ドメイン一覧"
  type        = list(string)
}

variable "admin_domains" {
  description = "管理画面用ドメイン一覧"
  type        = list(string)
}

variable "cloud_run_services" {
  description = "Cloud Run サービスのバックエンド設定"
  type = map(object({
    service_name = string
    timeout_sec  = number
    enable_cdn   = bool
  }))
}

variable "log_sample_rate" {
  description = "ログのサンプリングレート（0.0 - 1.0）"
  type        = number
  default     = 0.5
}
