variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "prefix" {
  description = "リソース名のプレフィックス"
  type        = string
  default     = "agentest"
}

variable "service_accounts" {
  description = "サービスアカウント定義マップ"
  type = map(object({
    display_name = string
    roles        = list(string)
  }))
  default = {
    api = {
      display_name = "Agentest API Service"
      roles = [
        "roles/cloudsql.client",
        "roles/storage.objectAdmin",
      ]
    }
    ws = {
      display_name = "Agentest WebSocket Service"
      roles = [
        "roles/cloudsql.client",
      ]
    }
    mcp = {
      display_name = "Agentest MCP Service"
      roles = [
        "roles/cloudsql.client",
      ]
    }
    web = {
      display_name = "Agentest Web Frontend"
      roles        = []
    }
    admin = {
      display_name = "Agentest Admin Frontend"
      roles        = []
    }
    jobs = {
      display_name = "Agentest Batch Jobs"
      roles = [
        "roles/cloudsql.client",
      ]
    }
    scheduler = {
      display_name = "Agentest Cloud Scheduler"
      roles = [
        "roles/run.invoker",
      ]
    }
  }
}
