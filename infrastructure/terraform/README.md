# Agentest Terraform Infrastructure

GCP インフラを Terraform で管理するための構成。

## ディレクトリ構造

```
terraform/
  bootstrap/                  # 初回セットアップ（tfstate用GCSバケット、API有効化）
  modules/                    # 再利用可能なモジュール
    networking/               # VPC、サブネット、VPCコネクタ
    cloud-sql/                # Cloud SQL (PostgreSQL 16)
    memorystore/              # Memorystore (Redis 7)
    artifact-registry/        # Docker イメージリポジトリ
    cloud-run-service/        # Cloud Run サービス（汎用）
    cloud-run-job/            # Cloud Run Jobs + Cloud Scheduler
    cloud-storage/            # GCS バケット
    secret-manager/           # Secret Manager + IAM
    load-balancer/            # Cloud LB + CDN + Cloud Armor + SSL
    iam/                      # サービスアカウント + IAM
  environments/
    staging/                  # staging 環境
    production/               # production 環境
```

## 前提条件

- Terraform >= 1.5
- Google Cloud SDK (`gcloud`)
- GCP プロジェクトへの Owner / Editor 権限

## 初回セットアップ（Bootstrap）

```bash
cd bootstrap

# terraform.tfvars を編集して project_id を設定
vim terraform.tfvars

terraform init
terraform plan
terraform apply
```

これにより以下が作成される:
- tfstate 保存用 GCS バケット
- 必要な GCP API の有効化

## 環境デプロイ

### 1. バックエンド設定

各環境ディレクトリの `backend.tf` で GCS バケット名を設定:

```bash
cd environments/staging  # または production

# terraform init 時にバケット名を指定
terraform init -backend-config="bucket=YOUR_PROJECT_ID-tfstate"
```

### 2. 変数設定

`terraform.tfvars` のコメントを外して値を設定するか、環境変数で指定:

```bash
export TF_VAR_project_id="agentest-staging"
export TF_VAR_database_password="$(openssl rand -base64 24)"
export TF_VAR_app_domain="app.staging.agentest.example.com"
export TF_VAR_admin_domain="admin.staging.agentest.example.com"
export TF_VAR_api_image="asia-northeast1-docker.pkg.dev/PROJECT_ID/agentest-docker/agentest-api:latest"
# ... 他のイメージも同様
```

### 3. プランと適用

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

## シークレット投入

Terraform でシークレットの「箱」を作成した後、値は `gcloud` で手動投入:

```bash
# シークレットの値を設定
echo -n "YOUR_SECRET_VALUE" | gcloud secrets versions add \
  agentest-staging-JWT_ACCESS_SECRET --data-file=-

# 全シークレットの一括設定例
for secret in DATABASE_URL REDIS_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET \
  INTERNAL_API_SECRET TOKEN_ENCRYPTION_KEY TOTP_ENCRYPTION_KEY \
  GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET \
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PUBLISHABLE_KEY \
  STRIPE_PRICE_PRO_MONTHLY STRIPE_PRICE_PRO_YEARLY \
  STRIPE_PRICE_TEAM_MONTHLY STRIPE_PRICE_TEAM_YEARLY \
  SMTP_USER SMTP_PASS; do
  echo "Set value for agentest-staging-${secret}:"
  read -s value
  echo -n "$value" | gcloud secrets versions add "agentest-staging-${secret}" --data-file=-
done
```

## 環境差分

| リソース | staging | production |
|---------|---------|------------|
| Cloud SQL tier | db-f1-micro | db-custom-2-7680 |
| Cloud SQL HA | ZONAL | REGIONAL |
| Cloud SQL PITR | 無効 | 有効 |
| Redis tier | BASIC (1GB) | STANDARD_HA (5GB) |
| Cloud Run min_instances | 0 | 1 |
| VPC Connector | e2-micro | e2-small |
| deletion_protection | false | true |

## DNS 設定

`terraform output lb_ip_address` で取得した IP アドレスを DNS に設定:

```
app.agentest.example.com    A  <LB_IP>
admin.agentest.example.com  A  <LB_IP>
```

## 運用コマンド

```bash
# 状態確認
terraform state list

# 特定リソースの詳細
terraform state show module.cloud_sql.google_sql_database_instance.main

# リソースの再作成（注意: データ損失の可能性）
terraform taint module.cloud_run_api.google_cloud_run_v2_service.main
terraform apply

# ドリフト検出
terraform plan -detailed-exitcode
```

## バッチジョブ手動実行

```bash
gcloud run jobs execute agentest-jobs-staging \
  --region=asia-northeast1 \
  --update-env-vars JOB_NAME=history-cleanup
```
