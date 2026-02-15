# C-5: Infrastructure as Code デプロイ計画

production-readiness.md の C-5 に対応するデプロイ計画。

## 現在の状態（2026-02-15 時点）

### 完了済み

- [x] Terraform コード作成（全10モジュール + 2環境）
- [x] GCP プロジェクト作成（`agentest-staging`）
- [x] gcloud CLI インストール・認証
- [x] Terraform インストール
- [x] Bootstrap 実行（GCS tfstate バケット + 13 API 有効化）
- [x] `.gitignore` に Terraform 除外ルール追加（`*.tfvars` 含む）
- [x] ドメイン取得（`agentest.jp` / お名前.com）
- [x] staging 環境 `terraform apply` 完了（全リソース作成済み）
- [x] Docker イメージのビルド＆プッシュ（全6サービス）
- [x] Secret Manager にシークレット値を投入（必須7件）
- [x] DNS 設定（お名前.com で A レコード登録済み）
- [x] ビルド・デプロイ用スクリプト作成

### デプロイ時に発見・修正したバグ

| 修正内容 | ファイル |
|---------|---------|
| Cloud Run v2 の ingress 値修正（`INGRESS_TRAFFIC_INTERNAL_AND_GCLB` → `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`） | `modules/cloud-run-service/variables.tf` |
| Cloud Armor のアクション修正（`throttle` → `rate_based_ban`） | `modules/load-balancer/main.tf` |
| Secret Manager の `for_each` キーを静的値に変更 | `modules/secret-manager/main.tf` |
| Private Service Access の伝播遅延対策（`time_sleep` 60秒追加） | `modules/networking/main.tf` |
| WebSocket サービスのメモリを 256Mi → 512Mi に変更（CPU常時割当の最低要件） | `environments/staging/main.tf` |
| LB バックエンドサービスの `timeout_sec` 削除（サーバーレスNEG非対応） | `modules/load-balancer/main.tf` |
| Dockerfile に `@agentest/ws-types` 依存追加（API, WS, Web） | `docker/Dockerfile.api`, `Dockerfile.ws`, `Dockerfile.web` |
| Dockerfile に `@agentest/shared` 依存追加（Admin） | `docker/Dockerfile.admin` |
| Dockerfile に `prisma generate` 追加、ルート `package.json` 追加（Jobs） | `apps/jobs/Dockerfile` |
| Prisma クライアントの COPY パス修正（`packages/db/node_modules/.prisma` → ルート `node_modules` に含まれる） | `docker/Dockerfile.api`, `Dockerfile.ws` |
| Docker ビルドに `--platform linux/amd64` 追加（Apple Silicon 対応） | `infrastructure/scripts/build-and-push.sh` |

### GCP 上に存在するリソース（staging）

| カテゴリ | リソース |
|---------|---------|
| ネットワーク | VPC, サブネット, Private Service Access, VPC コネクタ |
| データベース | Cloud SQL (PostgreSQL 16, db-f1-micro), Memorystore (Redis 7, 1GB) |
| コンピュート | Cloud Run × 5 (api, ws, mcp, web, admin), Cloud Run Job × 1 |
| ストレージ | GCS バケット (`agentest-storage-staging`), Artifact Registry |
| セキュリティ | Secret Manager (20件), Cloud Armor, IAM サービスアカウント |
| ロードバランサー | グローバル HTTPS LB, Google マネージド SSL 証明書 |
| スケジューラー | Cloud Scheduler (バッチジョブ用) |

### 主要な出力値

```
lb_ip_address     = 34.120.151.165
cloud_sql_private_ip = 10.46.1.3
redis_host        = 10.46.0.3
storage_bucket    = agentest-storage-staging
artifact_registry = asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker
```

### ドメイン設定

| ドメイン | TYPE | VALUE |
|---------|------|-------|
| `app.staging.agentest.jp` | A | `34.120.151.165` |
| `admin.staging.agentest.jp` | A | `34.120.151.165` |

---

## 次のステップ

### Step 1: SSL 証明書の発行待ち（進行中）

Google マネージド SSL 証明書が PROVISIONING 状態。DNS は反映済みだが、Google 側の検証がまだ完了していない。自動リトライされるため待機（最大24時間）。

```bash
# 状態確認コマンド
gcloud compute ssl-certificates describe agentest-app-cert-staging \
  --project=agentest-staging --format="get(managed.status,managed.domainStatus)"
# ACTIVE + app.staging.agentest.jp=ACTIVE になれば完了
```

### Step 2: Prisma マイグレーション

SSL 証明書が有効化された後、Cloud SQL にスキーマを適用する。

```bash
# Cloud SQL Proxy 経由で接続してマイグレーション実行
# （Cloud SQL はプライベート IP のみのため、直接接続不可）
gcloud sql connect agentest-db-staging --user=agentest --database=agentest

# または Cloud Run Job でマイグレーション実行
```

### Step 3: 動作確認

- [ ] SSL 証明書が ACTIVE になった
- [ ] `https://app.staging.agentest.jp` にアクセスできる
- [ ] `https://admin.staging.agentest.jp` にアクセスできる
- [ ] 各 Cloud Run サービスの `/health` 応答確認
- [ ] API → Cloud SQL 接続確認
- [ ] API → Redis 接続確認
- [ ] WebSocket 接続・メッセージ送受信
- [ ] MCP サーバー接続
- [ ] バッチジョブ手動実行テスト

### Step 4: 外部サービスシークレットの設定

以下のシークレットは現在プレースホルダー値。各サービスの準備ができたら更新する:

```bash
# GitHub OAuth（GitHub Developer Settings で作成）
gcloud secrets versions add agentest-staging-GITHUB_CLIENT_ID --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-GITHUB_CLIENT_SECRET --project=agentest-staging --data-file=-

# Google OAuth（Google Cloud Console で作成）
gcloud secrets versions add agentest-staging-GOOGLE_CLIENT_ID --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-GOOGLE_CLIENT_SECRET --project=agentest-staging --data-file=-

# Stripe（Stripe Dashboard から取得）
gcloud secrets versions add agentest-staging-STRIPE_SECRET_KEY --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-STRIPE_WEBHOOK_SECRET --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-STRIPE_PUBLISHABLE_KEY --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-STRIPE_PRICE_PRO_MONTHLY --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-STRIPE_PRICE_PRO_YEARLY --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-STRIPE_PRICE_TEAM_MONTHLY --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-STRIPE_PRICE_TEAM_YEARLY --project=agentest-staging --data-file=-

# SMTP（SendGrid 等のメールサービスから取得）
gcloud secrets versions add agentest-staging-SMTP_USER --project=agentest-staging --data-file=-
gcloud secrets versions add agentest-staging-SMTP_PASS --project=agentest-staging --data-file=-
```

---

### Step 5: production 環境デプロイ

**想定費用: 月 $400〜600**

staging で動作確認が完了した後に実施。

1. GCP プロジェクト `agentest-production` を別途作成
2. Bootstrap を production プロジェクトで実行
3. `environments/production/` で terraform apply
4. 本番用シークレット投入
5. 本番用 DNS 設定（`app.agentest.jp`, `admin.agentest.jp`）
6. SSL 証明書プロビジョニング待ち
7. Prisma マイグレーション
8. 最終動作確認

---

## 運用スクリプト

| スクリプト | 用途 |
|-----------|------|
| `infrastructure/scripts/build-and-push.sh` | 全6サービスのイメージビルド＆プッシュ（`--platform linux/amd64`） |
| `infrastructure/scripts/init-secrets.sh` | Secret Manager にプレースホルダー値を投入（初回セットアップ用） |
| `infrastructure/scripts/update-secrets.sh` | Secret Manager の必須シークレット値を更新 |

## 関連タスク

| タスク | 状態 | 依存関係 |
|-------|------|---------|
| C-1: CI/CD パイプライン | 未着手 | C-5 の後に実施すると効率的 |
| C-5: Infrastructure as Code | **staging デプロイ完了、SSL 証明書待ち** | - |
| C-6: シークレット管理 | 必須分完了、外部サービス分は未設定 | C-5 の Secret Manager モジュールで対応済み |
| H-8: MCP Dockerfile 作成 | **完了** | - |

## Terraform ファイル構成

```
infrastructure/terraform/
  README.md                           # 運用ガイド
  bootstrap/                          # ✅ 実行済み
    main.tf / variables.tf / outputs.tf / terraform.tfvars
  modules/                            # ✅ コード作成済み・バグ修正済み（10モジュール）
    iam/ networking/ cloud-sql/ memorystore/
    artifact-registry/ cloud-run-service/ cloud-run-job/
    cloud-storage/ secret-manager/ load-balancer/
  environments/
    staging/                          # ✅ デプロイ済み
    production/                       # ⏸️ staging 検証後にデプロイ
infrastructure/scripts/
  build-and-push.sh                   # ✅ イメージビルド＆プッシュ
  init-secrets.sh                     # ✅ 初期シークレット投入
  update-secrets.sh                   # ✅ シークレット値更新
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
