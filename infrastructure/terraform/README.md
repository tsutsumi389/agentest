# Agentest Terraform Infrastructure

GCP インフラを Terraform で管理するための構成。

デプロイ手順の詳細は [infrastructure/README.md](../README.md) を参照してください。

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
    example/                  # デプロイ用テンプレート環境
```

## 前提条件

- Terraform >= 1.5
- Google Cloud SDK (`gcloud`)
- GCP プロジェクトへの Owner / Editor 権限

## 初回セットアップ（Bootstrap）

```bash
cd bootstrap

# terraform.tfvars を作成
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars の project_id を編集

terraform init
terraform plan
terraform apply
```

これにより以下が作成される:
- tfstate 保存用 GCS バケット
- 必要な GCP API の有効化

## 環境デプロイ

### 1. バックエンド設定

```bash
cd environments/example

# terraform init 時にバケット名を指定
terraform init -backend-config="bucket=YOUR_PROJECT_ID-tfstate"
```

### 2. 変数設定

```bash
# テンプレートからコピー
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を編集

# データベースパスワードは環境変数で指定推奨
export TF_VAR_database_password="$(openssl rand -base64 24)"
```

### 3. プランと適用

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

## シークレット投入

Terraform でシークレットの「箱」を作成した後、値は `gcloud` で手動投入:

```bash
# ヘルパースクリプトで一括設定
cd ../../scripts
export PROJECT_ID="YOUR_PROJECT_ID"
export DATABASE_URL="postgresql://agentest:PASSWORD@CLOUD_SQL_IP:5432/agentest"
export REDIS_URL="redis://:REDIS_AUTH@REDIS_HOST:6379"
./update-secrets.sh
```

### シークレット一覧（13個）

| シークレット | 用途 | 設定タイミング |
|------------|------|--------------|
| DATABASE_URL | PostgreSQL 接続 | 初回デプロイ時 |
| REDIS_URL | Redis 接続 | 初回デプロイ時 |
| JWT_ACCESS_SECRET | アクセストークン署名 | 初回デプロイ時（自動生成） |
| JWT_REFRESH_SECRET | リフレッシュトークン署名 | 初回デプロイ時（自動生成） |
| INTERNAL_API_SECRET | 内部 API 認証 | 初回デプロイ時（自動生成） |
| TOKEN_ENCRYPTION_KEY | トークン暗号化 | 初回デプロイ時（自動生成） |
| TOTP_ENCRYPTION_KEY | TOTP 暗号化 | 初回デプロイ時（自動生成） |
| GITHUB_CLIENT_ID | GitHub OAuth | GitHub OAuth 使用時 |
| GITHUB_CLIENT_SECRET | GitHub OAuth | GitHub OAuth 使用時 |
| GOOGLE_CLIENT_ID | Google OAuth | Google OAuth 使用時 |
| GOOGLE_CLIENT_SECRET | Google OAuth | Google OAuth 使用時 |
| SMTP_USER | メール送信 | SMTP 使用時 |
| SMTP_PASS | メール送信 | SMTP 使用時 |

## DNS 設定

`terraform output lb_ip_address` で取得した IP アドレスを DNS に設定:

```
app.example.com    A  <LB_IP>
admin.example.com  A  <LB_IP>
```

## 運用コマンド

```bash
# 状態確認
terraform state list

# 特定リソースの詳細
terraform state show module.cloud_sql.google_sql_database_instance.main

# ドリフト検出
terraform plan -detailed-exitcode
```

## バッチジョブ手動実行

```bash
gcloud run jobs execute agentest-jobs-production \
  --region=asia-northeast1 \
  --update-env-vars JOB_NAME=history-cleanup
```
