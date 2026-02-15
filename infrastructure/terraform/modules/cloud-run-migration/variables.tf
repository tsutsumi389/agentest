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

variable "image" {
  description = "コンテナイメージ URL（Prisma CLI とマイグレーションファイルを含むイメージ）"
  type        = string
}

variable "cpu" {
  description = "CPU 割り当て"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "メモリ割り当て"
  type        = string
  default     = "512Mi"
}

variable "timeout" {
  description = "ジョブのタイムアウト（マイグレーションは通常短時間で完了する）"
  type        = string
  default     = "300s"
}

variable "service_account_email" {
  description = "ジョブ実行用サービスアカウントのメールアドレス"
  type        = string
}

variable "vpc_connector_id" {
  description = "VPC コネクタ ID（Cloud SQL プライベート IP 接続用）"
  type        = string
  default     = null
}

variable "env_vars" {
  description = "環境変数マップ"
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Secret Manager から注入する環境変数"
  type        = map(string)
  default     = {}
}
