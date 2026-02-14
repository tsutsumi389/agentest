# Production 環境固有の設定値
# project_id と database_password は環境変数または別途 .tfvars で指定

# project_id = "agentest-production"
# region     = "asia-northeast1"

# ドメイン設定
# app_domain   = "app.agentest.example.com"
# admin_domain = "admin.agentest.example.com"

# Docker イメージ（デプロイ時に指定）
# api_image   = "asia-northeast1-docker.pkg.dev/PROJECT_ID/agentest-docker/agentest-api:v1.0.0"
# ws_image    = "asia-northeast1-docker.pkg.dev/PROJECT_ID/agentest-docker/agentest-ws:v1.0.0"
# mcp_image   = "asia-northeast1-docker.pkg.dev/PROJECT_ID/agentest-docker/agentest-mcp:v1.0.0"
# web_image   = "asia-northeast1-docker.pkg.dev/PROJECT_ID/agentest-docker/agentest-web:v1.0.0"
# admin_image = "asia-northeast1-docker.pkg.dev/PROJECT_ID/agentest-docker/agentest-admin:v1.0.0"
# jobs_image  = "asia-northeast1-docker.pkg.dev/PROJECT_ID/agentest-docker/agentest-jobs:v1.0.0"
