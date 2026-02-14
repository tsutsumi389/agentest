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

variable "network_id" {
  description = "VPC ネットワーク ID"
  type        = string
}

variable "private_service_access_connection" {
  description = "Private Service Access 接続 ID（暗黙的な依存関係の確保用）"
  type        = string
}


variable "tier" {
  description = "Cloud SQL インスタンスのマシンタイプ"
  type        = string
  default     = "db-f1-micro"
}

variable "availability_type" {
  description = "可用性タイプ（ZONAL / REGIONAL）"
  type        = string
  default     = "ZONAL"
}

variable "disk_size_gb" {
  description = "ディスクサイズ（GB）"
  type        = number
  default     = 10
}

variable "pitr_enabled" {
  description = "ポイントインタイムリカバリの有効化"
  type        = bool
  default     = false
}

variable "backup_retained_count" {
  description = "バックアップ保持数"
  type        = number
  default     = 7
}

variable "max_connections" {
  description = "PostgreSQL の最大接続数"
  type        = string
  default     = "100"
}

variable "deletion_protection" {
  description = "削除保護の有効化"
  type        = bool
  default     = false
}

variable "database_name" {
  description = "データベース名"
  type        = string
  default     = "agentest"
}

variable "database_user" {
  description = "データベースユーザー名"
  type        = string
  default     = "agentest"
}

variable "database_password" {
  description = "データベースパスワード"
  type        = string
  sensitive   = true
}
