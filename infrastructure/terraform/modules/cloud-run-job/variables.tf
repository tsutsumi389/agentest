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
  description = "コンテナイメージ URL"
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

variable "job_timeout" {
  description = "ジョブのタイムアウト"
  type        = string
  default     = "1800s"
}

variable "max_retries" {
  description = "最大リトライ回数"
  type        = number
  default     = 1
}

variable "service_account_email" {
  description = "ジョブ実行用サービスアカウントのメールアドレス"
  type        = string
}

variable "scheduler_service_account_email" {
  description = "Cloud Scheduler 用サービスアカウントのメールアドレス"
  type        = string
}

variable "vpc_connector_id" {
  description = "VPC コネクタ ID"
  type        = string
  default     = null
}

variable "env_vars" {
  description = "共通環境変数マップ"
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Secret Manager から注入する環境変数"
  type        = map(string)
  default     = {}
}

variable "schedules" {
  description = "Cloud Scheduler のスケジュール定義"
  type = map(object({
    cron        = string
    job_name    = string
    description = string
  }))
  default = {
    plan-distribution-aggregation = {
      cron        = "5 0 * * *"
      job_name    = "plan-distribution-aggregation"
      description = "プラン分布集計"
    }
    metrics-aggregation = {
      cron        = "0 1 * * *"
      job_name    = "metrics-aggregation"
      description = "DAU/WAU/MAU メトリクス集計"
    }
    history-cleanup = {
      cron        = "0 3 * * *"
      job_name    = "history-cleanup"
      description = "FREE プランの古い履歴削除"
    }
    project-cleanup = {
      cron        = "0 4 * * *"
      job_name    = "project-cleanup"
      description = "ソフトデリート済みプロジェクトの物理削除"
    }
    webhook-retry = {
      cron        = "0 * * * *"
      job_name    = "webhook-retry"
      description = "失敗した決済 Webhook の再処理"
    }
    payment-event-cleanup = {
      cron        = "0 4 * * 0"
      job_name    = "payment-event-cleanup"
      description = "古い決済イベントの削除"
    }
    subscription-sync = {
      cron        = "0 5 * * 0"
      job_name    = "subscription-sync"
      description = "Stripe との状態同期"
    }
  }
}
