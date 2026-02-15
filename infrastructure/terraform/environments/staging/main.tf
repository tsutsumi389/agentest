# Staging 環境 - 全モジュール統合

locals {
  environment   = var.environment
  prefix        = var.prefix
  secret_prefix = "${var.prefix}-${local.environment}"
}

# --- Phase 1: 基盤インフラ ---

# IAM: サービスアカウント
module "iam" {
  source = "../../modules/iam"

  project_id = var.project_id
  prefix     = local.prefix
}

# Networking: VPC + サブネット + VPCコネクタ
module "networking" {
  source = "../../modules/networking"

  project_id             = var.project_id
  region                 = var.region
  prefix                 = local.prefix
  connector_machine_type = "e2-micro"
}

# Cloud SQL: PostgreSQL 16
module "cloud_sql" {
  source = "../../modules/cloud-sql"

  project_id                        = var.project_id
  region                            = var.region
  prefix                            = local.prefix
  environment                       = local.environment
  network_id                        = module.networking.network_id
  private_service_access_connection = module.networking.private_service_access_connection

  tier                = "db-f1-micro"
  availability_type   = "ZONAL"
  disk_size_gb        = 10
  pitr_enabled        = false
  deletion_protection = false
  max_connections     = "50"
  database_password   = var.database_password
}

# Memorystore: Redis 7
module "memorystore" {
  source = "../../modules/memorystore"

  project_id                        = var.project_id
  region                            = var.region
  prefix                            = local.prefix
  environment                       = local.environment
  network_id                        = module.networking.network_id
  private_service_access_connection = module.networking.private_service_access_connection

  tier           = "BASIC"
  memory_size_gb = 1
}

# Cloud Storage: GCS バケット
module "cloud_storage" {
  source = "../../modules/cloud-storage"

  project_id  = var.project_id
  region      = var.region
  prefix      = local.prefix
  environment = local.environment
  cors_origins = [
    "https://${var.app_domain}",
    "https://${var.admin_domain}",
  ]
}

# Artifact Registry: Docker リポジトリ
module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id  = var.project_id
  region      = var.region
  prefix      = local.prefix
  environment = local.environment
}

# --- Phase 2: シークレット + Cloud Run ---

# Secret Manager
module "secret_manager" {
  source = "../../modules/secret-manager"

  project_id             = var.project_id
  prefix                 = local.prefix
  environment            = local.environment
  service_account_emails = module.iam.service_account_emails
}

# Cloud Run Service: API
module "cloud_run_api" {
  source = "../../modules/cloud-run-service"

  project_id            = var.project_id
  region                = var.region
  prefix                = local.prefix
  environment           = local.environment
  service_name          = "api"
  image                 = var.api_image
  port                  = 3001
  memory                = "512Mi"
  cpu                   = "1"
  min_instances         = 0
  max_instances         = 5
  service_account_email = module.iam.service_account_emails["api"]
  vpc_connector_id      = module.networking.vpc_connector_id
  startup_probe_path    = "/health/live"

  env_vars = {
    NODE_ENV           = "production"
    LOG_LEVEL          = "info"
    API_BASE_URL       = "https://${var.app_domain}"
    FRONTEND_URL       = "https://${var.app_domain}"
    ADMIN_FRONTEND_URL = "https://${var.admin_domain}"
    CORS_ORIGIN        = "https://${var.app_domain},https://${var.admin_domain}"
  }

  secret_env_vars = {
    DATABASE_URL         = "${local.secret_prefix}-DATABASE_URL"
    REDIS_URL            = "${local.secret_prefix}-REDIS_URL"
    JWT_ACCESS_SECRET    = "${local.secret_prefix}-JWT_ACCESS_SECRET"
    JWT_REFRESH_SECRET   = "${local.secret_prefix}-JWT_REFRESH_SECRET"
    INTERNAL_API_SECRET  = "${local.secret_prefix}-INTERNAL_API_SECRET"
    TOKEN_ENCRYPTION_KEY = "${local.secret_prefix}-TOKEN_ENCRYPTION_KEY"
    TOTP_ENCRYPTION_KEY  = "${local.secret_prefix}-TOTP_ENCRYPTION_KEY"
    GITHUB_CLIENT_ID     = "${local.secret_prefix}-GITHUB_CLIENT_ID"
    GITHUB_CLIENT_SECRET = "${local.secret_prefix}-GITHUB_CLIENT_SECRET"
    GOOGLE_CLIENT_ID     = "${local.secret_prefix}-GOOGLE_CLIENT_ID"
    GOOGLE_CLIENT_SECRET = "${local.secret_prefix}-GOOGLE_CLIENT_SECRET"
    STRIPE_SECRET_KEY      = "${local.secret_prefix}-STRIPE_SECRET_KEY"
    STRIPE_WEBHOOK_SECRET  = "${local.secret_prefix}-STRIPE_WEBHOOK_SECRET"
    STRIPE_PUBLISHABLE_KEY = "${local.secret_prefix}-STRIPE_PUBLISHABLE_KEY"
    STRIPE_PRICE_PRO_MONTHLY  = "${local.secret_prefix}-STRIPE_PRICE_PRO_MONTHLY"
    STRIPE_PRICE_PRO_YEARLY   = "${local.secret_prefix}-STRIPE_PRICE_PRO_YEARLY"
    STRIPE_PRICE_TEAM_MONTHLY = "${local.secret_prefix}-STRIPE_PRICE_TEAM_MONTHLY"
    STRIPE_PRICE_TEAM_YEARLY  = "${local.secret_prefix}-STRIPE_PRICE_TEAM_YEARLY"
    SMTP_USER              = "${local.secret_prefix}-SMTP_USER"
    SMTP_PASS              = "${local.secret_prefix}-SMTP_PASS"
    MINIO_ENDPOINT         = "${local.secret_prefix}-MINIO_ENDPOINT"
    MINIO_ACCESS_KEY       = "${local.secret_prefix}-MINIO_ACCESS_KEY"
    MINIO_SECRET_KEY       = "${local.secret_prefix}-MINIO_SECRET_KEY"
    MINIO_BUCKET           = "${local.secret_prefix}-MINIO_BUCKET"
  }
}

# Cloud Run Service: WebSocket
module "cloud_run_ws" {
  source = "../../modules/cloud-run-service"

  project_id            = var.project_id
  region                = var.region
  prefix                = local.prefix
  environment           = local.environment
  service_name          = "ws"
  image                 = var.ws_image
  port                  = 3002
  memory                = "512Mi"
  cpu                   = "1"
  min_instances         = 0
  max_instances         = 3
  session_affinity      = true
  cpu_idle              = false # WebSocket 用に always-on CPU
  timeout               = "3600s"
  service_account_email = module.iam.service_account_emails["ws"]
  vpc_connector_id      = module.networking.vpc_connector_id
  startup_probe_path    = "/health/live"

  env_vars = {
    NODE_ENV  = "production"
    LOG_LEVEL = "info"
  }

  secret_env_vars = {
    DATABASE_URL       = "${local.secret_prefix}-DATABASE_URL"
    REDIS_URL          = "${local.secret_prefix}-REDIS_URL"
    JWT_ACCESS_SECRET  = "${local.secret_prefix}-JWT_ACCESS_SECRET"
    JWT_REFRESH_SECRET = "${local.secret_prefix}-JWT_REFRESH_SECRET"
  }
}

# Cloud Run Service: MCP
module "cloud_run_mcp" {
  source = "../../modules/cloud-run-service"

  project_id            = var.project_id
  region                = var.region
  prefix                = local.prefix
  environment           = local.environment
  service_name          = "mcp"
  image                 = var.mcp_image
  port                  = 3004
  memory                = "512Mi"
  cpu                   = "1"
  min_instances         = 0
  max_instances         = 3
  service_account_email = module.iam.service_account_emails["mcp"]
  vpc_connector_id      = module.networking.vpc_connector_id
  startup_probe_path    = "/health"
  health_check_path     = "/health"

  env_vars = {
    NODE_ENV         = "production"
    LOG_LEVEL        = "info"
    API_URL          = "https://${var.app_domain}"
    API_INTERNAL_URL = "https://${var.app_domain}"
  }

  secret_env_vars = {
    DATABASE_URL        = "${local.secret_prefix}-DATABASE_URL"
    REDIS_URL           = "${local.secret_prefix}-REDIS_URL"
    JWT_ACCESS_SECRET   = "${local.secret_prefix}-JWT_ACCESS_SECRET"
    JWT_REFRESH_SECRET  = "${local.secret_prefix}-JWT_REFRESH_SECRET"
    INTERNAL_API_SECRET = "${local.secret_prefix}-INTERNAL_API_SECRET"
  }
}

# Cloud Run Service: Web Frontend
module "cloud_run_web" {
  source = "../../modules/cloud-run-service"

  project_id            = var.project_id
  region                = var.region
  prefix                = local.prefix
  environment           = local.environment
  service_name          = "web"
  image                 = var.web_image
  port                  = 80
  memory                = "256Mi"
  cpu                   = "1"
  min_instances         = 0
  max_instances         = 5
  service_account_email = module.iam.service_account_emails["web"]
  health_check_path     = "/"

  env_vars = {
    NODE_ENV = "production"
  }
}

# Cloud Run Service: Admin Frontend
module "cloud_run_admin" {
  source = "../../modules/cloud-run-service"

  project_id            = var.project_id
  region                = var.region
  prefix                = local.prefix
  environment           = local.environment
  service_name          = "admin"
  image                 = var.admin_image
  port                  = 80
  memory                = "256Mi"
  cpu                   = "1"
  min_instances         = 0
  max_instances         = 2
  service_account_email = module.iam.service_account_emails["admin"]
  health_check_path     = "/"

  env_vars = {
    NODE_ENV = "production"
  }
}

# --- Phase 3: Load Balancer ---

module "load_balancer" {
  source = "../../modules/load-balancer"

  project_id    = var.project_id
  region        = var.region
  prefix        = local.prefix
  environment   = local.environment
  app_domains   = [var.app_domain]
  admin_domains = [var.admin_domain]

  cloud_run_services = {
    api = {
      service_name = module.cloud_run_api.service_name
      timeout_sec  = 60
      enable_cdn   = false
    }
    ws = {
      service_name = module.cloud_run_ws.service_name
      timeout_sec  = 3600
      enable_cdn   = false
    }
    mcp = {
      service_name = module.cloud_run_mcp.service_name
      timeout_sec  = 60
      enable_cdn   = false
    }
    web = {
      service_name = module.cloud_run_web.service_name
      timeout_sec  = 30
      enable_cdn   = true
    }
    admin = {
      service_name = module.cloud_run_admin.service_name
      timeout_sec  = 30
      enable_cdn   = true
    }
  }

  log_sample_rate = 1.0
}

# --- Phase 4: DB マイグレーション ---

# API イメージを使用（Prisma CLI + マイグレーションファイルを含む）
# デプロイ時に手動実行: gcloud run jobs execute agentest-db-migrate-staging --region asia-northeast1 --wait
module "cloud_run_migration" {
  source = "../../modules/cloud-run-migration"

  project_id            = var.project_id
  region                = var.region
  prefix                = local.prefix
  environment           = local.environment
  image                 = var.api_image
  service_account_email = module.iam.service_account_emails["api"]
  vpc_connector_id      = module.networking.vpc_connector_id

  env_vars = {
    NODE_ENV = "production"
  }

  secret_env_vars = {
    DATABASE_URL = "${local.secret_prefix}-DATABASE_URL"
  }
}

# --- Phase 5: バッチジョブ ---

module "cloud_run_job" {
  source = "../../modules/cloud-run-job"

  project_id                      = var.project_id
  region                          = var.region
  prefix                          = local.prefix
  environment                     = local.environment
  image                           = var.jobs_image
  memory                          = "512Mi"
  cpu                             = "1"
  service_account_email           = module.iam.service_account_emails["jobs"]
  scheduler_service_account_email = module.iam.service_account_emails["scheduler"]
  vpc_connector_id                = module.networking.vpc_connector_id

  env_vars = {
    NODE_ENV = "production"
    LOG_LEVEL = "info"
  }

  secret_env_vars = {
    DATABASE_URL      = "${local.secret_prefix}-DATABASE_URL"
    REDIS_URL         = "${local.secret_prefix}-REDIS_URL"
    STRIPE_SECRET_KEY = "${local.secret_prefix}-STRIPE_SECRET_KEY"
  }
}
