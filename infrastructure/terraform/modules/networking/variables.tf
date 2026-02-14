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

variable "subnet_cidr" {
  description = "メインサブネットの CIDR 範囲"
  type        = string
  default     = "10.0.0.0/20"
}

variable "connector_cidr" {
  description = "VPC コネクタの CIDR 範囲"
  type        = string
  default     = "10.8.0.0/28"
}

variable "connector_machine_type" {
  description = "VPC コネクタのマシンタイプ"
  type        = string
  default     = "e2-micro"
}

variable "connector_min_instances" {
  description = "VPC コネクタの最小インスタンス数"
  type        = number
  default     = 2
}

variable "connector_max_instances" {
  description = "VPC コネクタの最大インスタンス数"
  type        = number
  default     = 3
}
