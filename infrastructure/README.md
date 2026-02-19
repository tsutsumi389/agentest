# Agentest GCP デプロイガイド

Agentest を Google Cloud Platform (GCP) にセルフホストするためのガイドです。

## 概要

### ディレクトリ構成

```
infrastructure/
  terraform/
    bootstrap/                  # 初回セットアップ（tfstate用GCSバケット、API有効化）
    modules/                    # 再利用可能な Terraform モジュール
    environments/
      example/                  # デプロイ用テンプレート環境
  scripts/
    build-and-push.sh           # Docker イメージのビルド & プッシュ
    init-secrets.sh             # シークレットのプレースホルダー投入
    update-secrets.sh           # シークレットの値を更新
```

### 使用する GCP サービス

| サービス | 用途 |
|---------|------|
| Cloud Run | API、WebSocket、MCP、Web/Admin フロントエンド |
| Cloud Run Jobs | バッチジョブ（履歴削除、プロジェクト削除） |
| Cloud SQL | PostgreSQL 16 データベース |
| Memorystore | Redis 7 キャッシュ / Pub/Sub |
| Cloud Storage | ファイルストレージ |
| Secret Manager | シークレット管理（13個） |
| Artifact Registry | Docker イメージリポジトリ |
| Cloud Load Balancing | HTTPS ロードバランサー + CDN + Cloud Armor |
| VPC | プライベートネットワーク |
| Cloud Scheduler | バッチジョブのスケジューリング |

## 前提条件

- GCP アカウント + プロジェクト（課金有効化済み）
- [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install)
- [Terraform >= 1.5](https://developer.hashicorp.com/terraform/downloads)
- [Docker](https://docs.docker.com/get-docker/)（`buildx` プラグイン付き）
- 独自ドメイン 2つ（アプリ用 + 管理画面用）

## アーキテクチャ

```
                         ┌─────────────────────┐
                         │   Cloud Load Balancer │
                         │   (HTTPS + CDN)       │
                         └──────────┬────────────┘
                                    │
           ┌────────────┬───────────┼───────────┬────────────┐
           │            │           │           │            │
      ┌────┴───┐  ┌─────┴──┐  ┌────┴───┐  ┌───┴───┐  ┌────┴────┐
      │  Web   │  │ Admin  │  │  API   │  │  WS   │  │  MCP    │
      │ (SPA)  │  │ (SPA)  │  │        │  │       │  │         │
      └────────┘  └────────┘  └───┬────┘  └───┬───┘  └────┬────┘
                                  │            │           │
                         ┌────────┴────────────┴───────────┘
                         │         VPC (プライベート)
                    ┌────┴────┐          ┌──────────┐
                    │Cloud SQL│          │Memorystore│
                    │(Postgres)│         │ (Redis)   │
                    └─────────┘          └──────────┘
```

## デプロイ手順

### 1. GCP プロジェクトの作成と認証

```bash
# プロジェクト作成（既存のプロジェクトを使う場合はスキップ）
gcloud projects create YOUR_PROJECT_ID --name="Agentest"
gcloud config set project YOUR_PROJECT_ID

# 課金アカウントのリンク
gcloud billing accounts list
gcloud billing projects link YOUR_PROJECT_ID --billing-account=BILLING_ACCOUNT_ID

# 認証
gcloud auth login
gcloud auth application-default login
```

### 2. Bootstrap（初回のみ）

tfstate 保存用の GCS バケットと必要な GCP API を有効化します。

```bash
cd infrastructure/terraform/bootstrap

# tfvars を作成
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars の project_id を編集

terraform init
terraform plan
terraform apply
```

### 3. Docker イメージのビルド & プッシュ

```bash
cd infrastructure/scripts

export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="asia-northeast1"
export VITE_API_URL="https://app.example.com"
export VITE_WS_URL="wss://app.example.com"

./build-and-push.sh
```

### 4. Terraform 変数の設定

```bash
cd infrastructure/terraform/environments/example

# テンプレートからコピー
cp terraform.tfvars.example terraform.tfvars

# terraform.tfvars を編集:
#   - project_id: GCP プロジェクト ID
#   - app_domain: アプリ用ドメイン
#   - admin_domain: 管理画面用ドメイン
#   - *_image: ステップ3で出力されたダイジェスト付き URI
#
# SMTP を使用しない場合は以下も設定:
#   - require_email_verification = "false"
#
# SMTP を使用する場合:
#   - smtp_host = "smtp.example.com"
#   - smtp_port = 587
#   - smtp_from = "noreply@example.com"
```

### 5. Terraform Apply

```bash
# データベースパスワードを環境変数で設定
export TF_VAR_database_password="$(openssl rand -base64 24)"

# バックエンド初期化（tfstate の GCS バケットを指定）
terraform init -backend-config="bucket=YOUR_PROJECT_ID-tfstate"

# プランの確認
terraform plan -out=tfplan

# 適用
terraform apply tfplan
```

### 6. シークレットの初期化と設定

まず、Secret Manager に作成された全シークレット（13個）を初期化します。
必須シークレット（7個）には placeholder 値、オプションシークレット（6個）には空文字が投入されます。

> **重要:** OAuth のトグルは truthy チェック（`env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET`）です。
> オプションシークレットに placeholder を入れると意図せず OAuth が有効化され認証エラーになります。
> `init-secrets.sh` はオプションシークレットを空文字で初期化することでこの問題を回避します。

```bash
cd infrastructure/scripts

export PROJECT_ID="YOUR_PROJECT_ID"
# prefix/environment をデフォルトから変更した場合は以下も設定
# export PREFIX="agentest"
# export ENVIRONMENT="production"

./init-secrets.sh
```

次に、必須シークレット（DB接続、Redis接続、JWT/暗号化キー）の実際の値を設定します。
OAuth や SMTP を使用する場合は、対話的に設定できます。

```bash
# DB 接続情報の取得
# Cloud SQL プライベート IP: terraform output -raw cloud_sql_private_ip
# Redis ホスト: terraform output -raw redis_host
# Redis 認証文字列: gcloud redis instances get-auth-string <PREFIX>-redis-<ENVIRONMENT> --region <REGION>

export DATABASE_URL="postgresql://agentest:PASSWORD@CLOUD_SQL_IP:5432/agentest"
export REDIS_URL="redis://:REDIS_AUTH@REDIS_HOST:6379"

./update-secrets.sh
# → 必須シークレット設定後、GitHub OAuth / Google OAuth / SMTP の設定を対話的に選択
```

#### SMTP なしでデプロイする場合

メール送信機能なしでデプロイする場合は以下の設定が必要です:

1. `terraform.tfvars` で `require_email_verification = "false"` を設定
2. `init-secrets.sh` を実行（SMTP_USER / SMTP_PASS は空文字で初期化される）
3. `update-secrets.sh` で SMTP 設定の対話プロンプトをスキップ（N を選択）

この構成ではユーザー登録時のメール認証がスキップされ、OAuth またはメール＋パスワードで即座にログインできます。

### 7. DB マイグレーション

```bash
# <PREFIX> と <ENVIRONMENT> は terraform.tfvars の設定値に置き換えてください
# デフォルト: agentest-db-migrate-production
gcloud run jobs execute <PREFIX>-db-migrate-<ENVIRONMENT> \
  --region=<REGION> \
  --wait
```

### 8. DNS 設定

ロードバランサーの IP アドレスを DNS に設定します。

```bash
# IP アドレスの取得
cd infrastructure/terraform/environments/example
terraform output lb_ip_address
```

DNS レコードを追加:
```
app.example.com    A  <LB_IP>
admin.example.com  A  <LB_IP>
```

### 9. SSL 証明書のプロビジョニング

DNS 設定後、Google マネージド SSL 証明書が自動的にプロビジョニングされます。
完了まで 15〜30 分程度かかります。

### 10. 動作確認

```bash
# API ヘルスチェック
curl https://app.example.com/health

# Web フロントエンドの確認
open https://app.example.com

# 管理画面の確認
open https://admin.example.com
```

## コスト見積もり

小規模構成（db-f1-micro、Redis BASIC 1GB）の場合:

| サービス | 月額（概算） |
|---------|-------------|
| Cloud SQL (db-f1-micro) | ~$10 |
| Memorystore (1GB BASIC) | ~$35 |
| Cloud Run | ~$5-20 |
| Cloud Storage | ~$1 |
| Load Balancer | ~$20 |
| Secret Manager | ~$1 |
| その他（DNS、ログ等） | ~$5-10 |
| **合計** | **~$80-110** |

> Cloud Run は使用量に応じた従量課金のため、トラフィックによって変動します。

## 運用・メンテナンス

### イメージの更新

```bash
cd infrastructure/scripts
export PROJECT_ID="YOUR_PROJECT_ID"
export VITE_API_URL="https://app.example.com"
export VITE_WS_URL="wss://app.example.com"

./build-and-push.sh

cd ../terraform/environments/example
terraform apply
```

### スケールアップ

`terraform.tfvars` または `main.tf` で以下を調整:

- **Cloud SQL**: `tier = "db-custom-2-7680"`, `availability_type = "REGIONAL"`
- **Redis**: `tier = "STANDARD_HA"`, `memory_size_gb = 5`
- **Cloud Run**: `min_instances = 1`, `max_instances = 10`

### バッチジョブの手動実行

```bash
# <PREFIX> と <ENVIRONMENT> は terraform.tfvars の設定値に置き換えてください
gcloud run jobs execute <PREFIX>-jobs-<ENVIRONMENT> \
  --region=<REGION> \
  --update-env-vars JOB_NAME=history-cleanup
```

## クリーンアップ

すべてのリソースを削除する場合:

```bash
cd infrastructure/terraform/environments/example

# 全リソース削除
# database_password は destroy 時にも必要（値は任意）
terraform destroy -var="database_password=unused"

# Bootstrap リソースの削除（任意）
cd ../../bootstrap
terraform destroy
```

> **注意**: `terraform destroy` は Cloud SQL データベースを含むすべてのリソースを削除します。事前にバックアップを取得してください。

## 詳細リファレンス

Terraform モジュールの詳細は [terraform/README.md](terraform/README.md) を参照してください。
