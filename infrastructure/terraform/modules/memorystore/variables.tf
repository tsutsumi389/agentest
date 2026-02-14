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
  description = "Private Service Access 接続 ID（depends_on 用）"
  type        = string
}

variable "tier" {
  description = "Redis ティア（BASIC / STANDARD_HA）"
  type        = string
  default     = "BASIC"
}

variable "memory_size_gb" {
  description = "Redis メモリサイズ（GB）"
  type        = number
  default     = 1
}
