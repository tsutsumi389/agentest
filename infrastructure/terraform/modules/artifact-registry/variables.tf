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

variable "keep_count" {
  description = "保持するイメージバージョン数"
  type        = number
  default     = 10
}

variable "untagged_retention_days" {
  description = "タグなしイメージの保持日数"
  type        = number
  default     = 7
}
