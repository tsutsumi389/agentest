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

variable "service_name" {
  description = "サービス名（api, ws, mcp, web, admin）"
  type        = string
}

variable "image" {
  description = "コンテナイメージ URL"
  type        = string
}

variable "port" {
  description = "コンテナのリッスンポート"
  type        = number
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

variable "min_instances" {
  description = "最小インスタンス数"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "最大インスタンス数"
  type        = number
  default     = 5
}

variable "cpu_idle" {
  description = "アイドル時の CPU スロットリング（false = always-on CPU）"
  type        = bool
  default     = true
}

variable "startup_cpu_boost" {
  description = "スタートアップ時の CPU ブースト有効化"
  type        = bool
  default     = true
}

variable "timeout" {
  description = "リクエストタイムアウト"
  type        = string
  default     = "300s"
}

variable "session_affinity" {
  description = "セッションアフィニティ（WebSocket 用）"
  type        = bool
  default     = false
}

variable "ingress" {
  description = "Ingress 設定（LB経由のみに制限してCloud Armorバイパスを防止）"
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
}

variable "service_account_email" {
  description = "サービスアカウントのメールアドレス"
  type        = string
}

variable "vpc_connector_id" {
  description = "VPC コネクタ ID（null の場合はコネクタなし）"
  type        = string
  default     = null
}

variable "env_vars" {
  description = "環境変数マップ"
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Secret Manager から注入する環境変数（key=環境変数名, value=シークレットID）"
  type        = map(string)
  default     = {}
}

variable "health_check_path" {
  description = "liveness probe のパス"
  type        = string
  default     = "/health"
}

variable "startup_probe_path" {
  description = "startup probe のパス（未指定時は health_check_path を使用）"
  type        = string
  default     = null
}

variable "startup_probe_initial_delay" {
  description = "startup probe の初期遅延秒数"
  type        = number
  default     = 5
}

variable "allow_unauthenticated" {
  description = "未認証アクセスの許可"
  type        = bool
  default     = true
}
