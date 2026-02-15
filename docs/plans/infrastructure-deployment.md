# C-5: Infrastructure as Code デプロイ計画

production-readiness.md の C-5 に対応するデプロイ計画。

## 現在の状態（2026-02-16 時点）

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
- [x] Secret Manager にシークレット値を投入（必須7件 + MINIO 4件）
- [x] DNS 設定（お名前.com で A レコード登録済み）
- [x] ビルド・デプロイ用スクリプト作成
- [x] Dockerfile 全面修正（pnpm 互換性、OCI フォーマット対応）
- [x] Cloud Run 全5サービス起動成功（api, ws, mcp, web, admin）
- [x] Terraform 環境変数をアプリの env スキーマと整合

### デプロイ時に発見・修正したバグ

#### Phase 1（インフラ構築時）

| 修正内容 | ファイル |
|---------|---------|
| Cloud Run v2 の ingress 値修正（`INGRESS_TRAFFIC_INTERNAL_AND_GCLB` → `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER`） | `modules/cloud-run-service/variables.tf` |
| Cloud Armor のアクション修正（`throttle` → `rate_based_ban`） | `modules/load-balancer/main.tf` |
| Secret Manager の `for_each` キーを静的値に変更 | `modules/secret-manager/main.tf` |
| Private Service Access の伝播遅延対策（`time_sleep` 60秒追加） | `modules/networking/main.tf` |
| WebSocket サービスのメモリを 256Mi → 512Mi に変更（CPU常時割当の最低要件） | `environments/staging/main.tf` |
| LB バックエンドサービスの `timeout_sec` 削除（サーバーレスNEG非対応） | `modules/load-balancer/main.tf` |

#### Phase 2（Docker ビルド修正）

| 修正内容 | ファイル |
|---------|---------|
| OCI イメージフォーマットエラー修正（`--provenance=false --sbom=false` 追加） | `infrastructure/scripts/build-and-push.sh` |
| `docker build` → `docker buildx build --push` に変更 | `infrastructure/scripts/build-and-push.sh` |
| digest ベースのイメージ参照に変更（`:latest` → `@sha256:...`） | `infrastructure/scripts/build-and-push.sh` |
| pnpm symlink 問題を `node-linker=hoisted` で解決 | 全 Dockerfile |
| `pnpm --filter` → 直接 `tsc -p` 実行に変更 | 全バックエンド Dockerfile |
| `ENV PATH="/app/node_modules/.bin:$PATH"` 追加 | 全バックエンド Dockerfile |
| ワークスペースパッケージの symlink を builder/runner 両ステージに追加 | 全バックエンド Dockerfile |
| `.dockerignore` を `**/node_modules`, `**/dist` に修正 | `.dockerignore` |
| Vite ビルドを `cd apps/xxx && vite build` に変更（Tailwind 設定解決） | `Dockerfile.web`, `Dockerfile.admin` |
| ワークスペースパッケージの型定義を事前ビルド（`tsc -p packages/shared`） | `Dockerfile.web`, `Dockerfile.admin` |

#### Phase 3（Cloud Run 起動修正）

| 修正内容 | ファイル |
|---------|---------|
| startup probe に `/health/live` を追加（DB/Redis 不要のエンドポイント） | `modules/cloud-run-service/main.tf`, `environments/staging/main.tf` |
| WS サーバーに HTTP ヘルスチェックエンドポイント追加（WebSocket は 426 を返すため） | `apps/ws/src/server.ts` |
| MCP の health check パスを `/health` に修正（`/health/live` は存在しない） | `environments/staging/main.tf` |
| Cloud Run v2 の予約語 `PORT` を env_vars から削除（自動設定される） | `environments/staging/main.tf` |
| ストレージクライアントを遅延初期化に変更（MINIO_* 未設定でも起動可能に） | `apps/api/src/services/execution.service.ts` |
| API 環境変数名を env スキーマに合わせて修正（`API_URL` → `API_BASE_URL` 等） | `environments/staging/main.tf` |
| WS の不要なシークレット参照を削除（`DATABASE_URL` のみ残し、DB_HOST 等を削除） | `environments/staging/main.tf` |
| MCP に `API_INTERNAL_URL` 環境変数を追加 | `environments/staging/main.tf` |
| MINIO_* シークレットを Secret Manager モジュールに追加（IAM 権限付与） | `modules/secret-manager/variables.tf` |
| DATABASE_URL のパスワード URL エンコード修正（`*` → `%2A`） | Secret Manager |
| Cloud SQL パスワードリセット | Cloud SQL |

### Cloud Run サービス状態

| サービス | 状態 | ポート | ヘルスチェック |
|---------|------|-------|--------------|
| agentest-api | ✅ 稼働中 | 3001 | `/health/live` (startup), `/health` (liveness) |
| agentest-ws | ✅ 稼働中 | 3002 | `/health/live` |
| agentest-mcp | ✅ 稼働中 | 3004 | `/health` |
| agentest-web | ✅ 稼働中 | 80 | `/` |
| agentest-admin | ✅ 稼働中 | 80 | `/` |

### GCP 上に存在するリソース（staging）

| カテゴリ | リソース |
|---------|---------|
| ネットワーク | VPC, サブネット, Private Service Access, VPC コネクタ |
| データベース | Cloud SQL (PostgreSQL 16, db-f1-micro), Memorystore (Redis 7, 1GB) |
| コンピュート | Cloud Run × 5 (api, ws, mcp, web, admin), Cloud Run Job × 1 |
| ストレージ | GCS バケット (`agentest-storage-staging`), Artifact Registry |
| セキュリティ | Secret Manager (24件), Cloud Armor, IAM サービスアカウント |
| ロードバランサー | グローバル HTTPS LB, Google マネージド SSL 証明書 |
| スケジューラー | Cloud Scheduler (バッチジョブ用) |

### 主要な出力値

```
lb_ip_address      = 34.120.151.165
cloud_sql_private_ip = 10.46.1.3
redis_host         = 10.46.0.3
storage_bucket     = agentest-storage-staging
artifact_registry  = asia-northeast1-docker.pkg.dev/agentest-staging/agentest-docker
```

### ドメイン設定

| ドメイン | TYPE | VALUE |
|---------|------|-------|
| `app.staging.agentest.jp` | A | `34.120.151.165` |
| `admin.staging.agentest.jp` | A | `34.120.151.165` |

---

## 次のステップ

### Step 1: Prisma マイグレーション（未完了）

Cloud SQL はプライベート IP のみのため、ローカルの cloud-sql-proxy 経由では Prisma エンジンが接続できない問題がある。以下のいずれかの方法で実行する:

**方法 A: Cloud SQL のパブリック IP を一時的に有効化**

```bash
# パブリック IP を有効化
gcloud sql instances patch agentest-db-staging --assign-ip --project=agentest-staging

# マイグレーション実行
cloud-sql-proxy agentest-staging:asia-northeast1:agentest-db-staging --port=15432 &
DATABASE_URL='postgresql://agentest:<password>@127.0.0.1:15432/agentest' \
  pnpm --filter @agentest/db exec prisma migrate deploy

# パブリック IP を無効化（セキュリティのため）
gcloud sql instances patch agentest-db-staging --no-assign-ip --project=agentest-staging
```

**方法 B: Cloud Shell から実行**

GCP コンソールの Cloud Shell（`>_` アイコン）からリポジトリをクローンして実行。

**方法 C: Cloud Run Job でマイグレーション実行**

マイグレーション専用の Cloud Run Job を作成し、VPC コネクタ経由でプライベート IP に接続。

### Step 2: SSL 証明書の確認

```bash
gcloud compute ssl-certificates describe agentest-app-cert-staging \
  --project=agentest-staging --format="get(managed.status,managed.domainStatus)"
# ACTIVE + app.staging.agentest.jp=ACTIVE になれば完了
```

### Step 3: 動作確認

- [ ] Prisma マイグレーション完了
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
| `infrastructure/scripts/build-and-push.sh` | 全6サービスのイメージビルド＆プッシュ（`docker buildx build --push --provenance=false --sbom=false`） |
| `infrastructure/scripts/init-secrets.sh` | Secret Manager にプレースホルダー値を投入（初回セットアップ用） |
| `infrastructure/scripts/update-secrets.sh` | Secret Manager の必須シークレット値を更新 |

## 関連タスク

| タスク | 状態 | 依存関係 |
|-------|------|---------|
| C-1: CI/CD パイプライン | 未着手 | C-5 の後に実施すると効率的 |
| C-5: Infrastructure as Code | **全サービス起動完了、DB マイグレーション待ち** | - |
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
    staging/                          # ✅ デプロイ済み・全サービス稼働中
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

## 学んだこと

### pnpm + Docker の互換性

pnpm のシンボリックリンク構造は Docker の `COPY` と互換性がない。`node-linker=hoisted` を使って npm 互換のフラットな `node_modules` を生成する必要がある。また、ワークスペースパッケージ（`@agentest/*`）の symlink は builder/runner 両ステージで手動作成が必要。

### Docker buildx と Cloud Run

Docker Desktop の buildx はデフォルトで OCI イメージインデックスを生成するが、Cloud Run は `amd64/linux` をサポートするマニフェストを要求する。`--provenance=false --sbom=false` が必要。

### Cloud Run v2 の予約環境変数

`PORT` は Cloud Run v2 が `container_port` から自動設定する予約語。`env_vars` に明示指定するとエラーになる。

### Terraform とシークレットの更新

Terraform はインフラ設定の変更のみを検出する。Secret Manager のシークレット値を変更しただけでは Cloud Run の新リビジョンは作成されない。`gcloud run services update --update-labels=force-deploy=$(date +%s)` で強制再デプロイが必要。
