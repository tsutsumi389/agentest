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
  description = "環境名"
  type        = string
}

variable "versioning_enabled" {
  description = "バージョニングの有効化"
  type        = bool
  default     = true
}

variable "cors_origins" {
  description = "CORS 許可オリジン"
  type        = list(string)
  default     = []
}
