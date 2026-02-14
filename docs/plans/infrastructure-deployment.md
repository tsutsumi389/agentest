# C-5: Infrastructure as Code デプロイ計画

production-readiness.md の C-5 に対応するデプロイ計画。

## 現在の状態（2026-02-14 時点）

### 完了済み

- [x] Terraform コード作成（全10モジュール + 2環境）
- [x] GCP プロジェクト作成（`agentest-staging`）
- [x] gcloud CLI インストール・認証
- [x] Terraform インストール
- [x] Bootstrap 実行（GCS tfstate バケット + 13 API 有効化）
- [x] `.gitignore` に Terraform 除外ルール追加

### GCP 上に存在するリソース

| リソース | 名前 |
|---------|------|
| GCS バケット | `agentest-staging-tfstate` |
| 有効化済み API | compute, sqladmin, redis, run, secretmanager, artifactregistry, cloudscheduler, servicenetworking, vpcaccess, cloudresourcemanager, iam, certificatemanager, dns |

### まだ作成されていないリソース

VPC, Cloud SQL, Redis, Cloud Run, Secret Manager, Load Balancer, Cloud Armor, Artifact Registry, Cloud Storage, Cloud Scheduler 等（staging 環境の全リソース）

---

## 次のステップ

### Step 1: 前提条件の準備

staging 環境デプロイの前に以下を準備する。

#### 1-1. ドメインの取得・設定

- `app.staging.agentest.example.com` （ユーザー向け）
- `admin.staging.agentest.example.com` （管理画面）
- ドメインレジストラで取得し、terraform apply 後に A レコードを設定

#### 1-2. Docker イメージのビルド

各サービスの Docker イメージをビルドできる状態にする。staging デプロイ時に `var.api_image` 等で渡す。

```bash
# Artifact Registry へのプッシュ例（staging デプロイ後に実行）
gcloud auth configure-docker asia-northeast1-docker.pkg.dev

docker build -f docker/Dockerfile.api -t asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-api:latest .
docker push asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-api:latest
```

対象イメージ:
- `agentest-api` (docker/Dockerfile.api)
- `agentest-ws` (docker/Dockerfile.ws)
- `agentest-mcp` (docker/Dockerfile.mcp) ※要作成（C-5 の前提条件 H-8）
- `agentest-web` (docker/Dockerfile.web)
- `agentest-admin` (docker/Dockerfile.admin)
- `agentest-jobs` (apps/jobs/Dockerfile)

#### 1-3. シークレット値の準備

以下の値を事前に生成・取得しておく:

```bash
# 自動生成するもの
openssl rand -base64 32  # JWT_ACCESS_SECRET
openssl rand -base64 32  # JWT_REFRESH_SECRET
openssl rand -hex 32     # INTERNAL_API_SECRET
openssl rand -base64 32  # TOKEN_ENCRYPTION_KEY
openssl rand -base64 32  # TOTP_ENCRYPTION_KEY

# 外部サービスから取得するもの
# - GitHub OAuth: GitHub Developer Settings で作成
# - Google OAuth: Google Cloud Console で作成
# - Stripe: Stripe Dashboard から取得
# - SMTP: SendGrid 等のメールサービスから取得
```

#### 1-4. CI/CD パイプライン（C-1）

C-1（GitHub Actions）の構築が完了していると、イメージのビルド・プッシュとデプロイが自動化される。手動デプロイも可能だが、CI/CD があると効率的。

---

### Step 2: staging 環境デプロイ

**想定費用: 月 $80〜120**

#### 2-1. terraform.tfvars の設定

```bash
cd infrastructure/terraform/environments/staging
```

`terraform.tfvars` を編集するか、環境変数で値を渡す:

```bash
export TF_VAR_project_id="agentest-staging"
export TF_VAR_database_password="$(openssl rand -base64 24)"
export TF_VAR_app_domain="app.staging.agentest.example.com"
export TF_VAR_admin_domain="admin.staging.agentest.example.com"
export TF_VAR_api_image="asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-api:latest"
export TF_VAR_ws_image="asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-ws:latest"
export TF_VAR_mcp_image="asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-mcp:latest"
export TF_VAR_web_image="asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-web:latest"
export TF_VAR_admin_image="asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-admin:latest"
export TF_VAR_jobs_image="asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-jobs:latest"
```

#### 2-2. Terraform 実行

```bash
terraform init -backend-config="bucket=agentest-staging-tfstate"
terraform plan -out=tfplan
terraform apply tfplan
```

#### 2-3. シークレット値の投入

```bash
# 各シークレットの値を Secret Manager に投入
echo -n "YOUR_VALUE" | gcloud secrets versions add agentest-staging-JWT_ACCESS_SECRET --data-file=-
# ... 全20個のシークレットについて実行
```

#### 2-4. DNS 設定

`terraform output lb_ip_address` で表示された IP を DNS に設定:

```
app.staging.agentest.example.com    A  <LB_IP>
admin.staging.agentest.example.com  A  <LB_IP>
```

#### 2-5. Prisma マイグレーション

```bash
# Cloud SQL にスキーマを適用
docker run --rm \
  -e DATABASE_URL="postgresql://agentest:PASSWORD@CLOUD_SQL_IP/agentest" \
  asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker/agentest-api:latest \
  pnpm --filter @agentest/db prisma migrate deploy
```

#### 2-6. 動作確認

- [ ] 各 Cloud Run サービスの `/health` 応答確認
- [ ] API → Cloud SQL 接続確認
- [ ] API → Redis 接続確認
- [ ] WebSocket 接続・メッセージ送受信
- [ ] Web / Admin フロントエンドの表示
- [ ] MCP サーバー接続
- [ ] Cloud Armor レートリミットテスト
- [ ] CDN キャッシュヒット確認
- [ ] バッチジョブ手動実行テスト

---

### Step 3: production 環境デプロイ

**想定費用: 月 $400〜600**

staging で動作確認が完了した後に実施。

1. GCP プロジェクト `agentest-production` を別途作成
2. Bootstrap を production プロジェクトで実行
3. `environments/production/` で terraform apply
4. 本番用シークレット投入
5. 本番用 DNS 設定
6. SSL 証明書プロビジョニング待ち
7. 最終動作確認

---

## 関連タスク

| タスク | 状態 | 依存関係 |
|-------|------|---------|
| C-1: CI/CD パイプライン | 未着手 | C-5 の後に実施すると効率的 |
| C-5: Infrastructure as Code | **Terraform コード完了、Bootstrap 完了** | - |
| C-6: シークレット管理 | 未着手 | C-5 の Secret Manager モジュールで対応済み |
| H-8: MCP Dockerfile 作成 | 未着手 | staging デプロイ前に必要 |

## Terraform ファイル構成

```
infrastructure/terraform/
  README.md                           # 運用ガイド
  bootstrap/                          # ✅ 実行済み
    main.tf / variables.tf / outputs.tf / terraform.tfvars
  modules/                            # ✅ コード作成済み（10モジュール）
    iam/ networking/ cloud-sql/ memorystore/
    artifact-registry/ cloud-run-service/ cloud-run-job/
    cloud-storage/ secret-manager/ load-balancer/
  environments/                       # ⏸️ 未実行
    staging/                          # 次にデプロイする環境
    production/                       # staging 検証後にデプロイ
```

## コスト管理

staging 環境を使わないときは Cloud SQL と Memorystore を停止するとコストを抑えられる:

```bash
# Cloud SQL の停止（月 ~$30 節約）
gcloud sql instances patch agentest-db-staging --activation-policy=NEVER

# 再開
gcloud sql instances patch agentest-db-staging --activation-policy=ALWAYS
```

Cloud Run は min_instances=0 なのでリクエストがなければ自動で $0 になる。
