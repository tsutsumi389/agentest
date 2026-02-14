# C-5: Infrastructure as Code の実装

## Context

`infrastructure/terraform/` には `.gitkeep` のみが存在し、GCPインフラが手動構築の状態。
本番デプロイに向けて、Cloud Run / Cloud SQL / Memorystore / Secret Manager 等の全GCPリソースをTerraformで管理可能にする。
production-readiness.md の C-5 に該当し、C-6（シークレット管理）とも密接に関連する。

---

## ディレクトリ構造

```
infrastructure/terraform/
  README.md                           # 運用ガイド

  bootstrap/                          # 初回のみ手動実行（tfstate用GCSバケット、API有効化）
    main.tf
    variables.tf
    outputs.tf
    terraform.tfvars

  modules/
    networking/                       # VPC、サブネット、サーバーレスVPCコネクタ
    cloud-sql/                        # Cloud SQL (PostgreSQL 16)
    memorystore/                      # Memorystore (Redis 7)
    artifact-registry/                # Docker イメージリポジトリ
    cloud-run-service/                # Cloud Run サービス（汎用、5サービスで再利用）
    cloud-run-job/                    # Cloud Run Jobs + Cloud Scheduler
    cloud-storage/                    # GCS バケット（MinIO代替）
    secret-manager/                   # Secret Manager シークレット群 + IAM
    load-balancer/                    # Cloud LB + CDN + Cloud Armor + SSL
    iam/                              # サービスアカウント + IAMバインディング

  environments/
    staging/                          # staging 環境ルート
      main.tf / variables.tf / outputs.tf
      terraform.tfvars                # staging 固有値
      backend.tf / providers.tf
    production/                       # production 環境ルート
      main.tf / variables.tf / outputs.tf
      terraform.tfvars                # production 固有値
      backend.tf / providers.tf
```

**環境分離: ディレクトリベース**（workspace方式ではなく）。理由:
- staging/production のリソースサイズが大きく異なる
- 環境ごとに独立した state で誤操作リスクをゼロに
- CI/CD で環境ごとに別の承認フローを適用可能

---

## モジュール設計

### 1. `modules/networking`
- VPC（auto_create_subnetworks = false）
- サブネット（private_ip_google_access = true）
- Private Service Access（Cloud SQL / Redis 向け）
- サーバーレス VPC コネクタ（Cloud Run → VPC 内リソース接続用）

### 2. `modules/cloud-sql`
- PostgreSQL 16 インスタンス（プライベート IP のみ、外部IP無効）
- データベース `agentest` + ユーザー作成
- バックアップ、メンテナンスウィンドウ設定
- production: HA（REGIONAL）、PITR有効、deletion_protection

### 3. `modules/memorystore`
- Redis 7.0（Private Service Access 経由）
- 認証有効、転送暗号化
- production: STANDARD_HA

### 4. `modules/artifact-registry`
- Docker 形式リポジトリ
- 古いイメージの自動クリーンアップポリシー

### 5. `modules/cloud-run-service`（汎用）
API, WS, MCP, Web, Admin の5サービスで再利用。主要パラメータ:

| サービス | port | memory(stg/prd) | min(stg/prd) | max(stg/prd) | 特記 |
|---------|------|-----------------|-------------|-------------|------|
| api | 3001 | 512Mi/1Gi | 0/1 | 5/20 | VPCコネクタ必要 |
| ws | 3002 | 256Mi/512Mi | 0/1 | 3/10 | session_affinity=true, cpu_throttling=false |
| mcp | 3004 | 512Mi/512Mi | 0/1 | 3/5 | VPCコネクタ必要 |
| web | 80 | 256Mi/256Mi | 0/1 | 5/10 | CDN有効、VPCコネクタ不要 |
| admin | 80 | 256Mi/256Mi | 0/1 | 2/5 | CDN有効、VPCコネクタ不要 |

- ヘルスチェック: `/health`（startup_probe + liveness_probe）
- Secret Manager からのシークレット注入
- Cloud Run v2 API 使用

### 6. `modules/cloud-run-job`
- Cloud Run Job 定義（`agentest-jobs` イメージ）
- Cloud Scheduler で `for_each` 展開:

| スケジュール名 | cron | JOB_NAME |
|-------------|------|----------|
| plan-distribution-aggregation | `5 0 * * *` | plan-distribution-aggregation |
| metrics-aggregation | `0 1 * * *` | metrics-aggregation |
| history-cleanup | `0 3 * * *` | history-cleanup |
| project-cleanup | `0 4 * * *` | project-cleanup |
| webhook-retry | `0 * * * *` | webhook-retry |
| payment-event-cleanup | `0 4 * * 0` | payment-event-cleanup |
| subscription-sync | `0 5 * * 0` | subscription-sync |

※ `metrics-backfill` は手動実行のみのためスケジュールに含めない

### 7. `modules/secret-manager`
- 全シークレットのリソース定義（`for_each`）
- サービスアカウントごとの最小権限アクセス（`secretAccessor`）
- **シークレットの値は Terraform で管理しない**（state への平文保存を防止）
- 値は `gcloud secrets versions add` で手動投入

管理対象シークレット（`.env.example` より）:
DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, INTERNAL_API_SECRET, TOKEN_ENCRYPTION_KEY, TOTP_ENCRYPTION_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY, STRIPE_PRICE_TEAM_MONTHLY, STRIPE_PRICE_TEAM_YEARLY, SMTP_USER, SMTP_PASS

### 8. `modules/load-balancer`
- **ホストベースルーティング**:
  - `app.agentest.example.com` → web（デフォルト）, api（`/api/*`, `/auth/*`）, ws（`/ws`）, mcp（`/mcp`)
  - `admin.agentest.example.com` → admin（デフォルト）, api（`/admin/auth/*`, `/api/admin/*`）
- Cloud CDN: web/admin バックエンドに有効
- Google マネージド SSL 証明書
- HTTP → HTTPS リダイレクト
- WS バックエンド: timeout=3600s（WebSocket対応）

**Cloud Armor**:
- 認証エンドポイント（`/api/auth/*`, `/admin/auth/*`, `/oauth/*`）: 10 req/min/IP、超過時10分BAN
- 一般API: 100 req/min/IP
- デフォルト: allow

### 9. `modules/iam`
サービスアカウント + 最小権限マッピング:

| SA | 用途 | 主要ロール |
|----|------|----------|
| agentest-api | API | cloudsql.client, secretmanager.secretAccessor, storage.objectAdmin |
| agentest-ws | WS | cloudsql.client, secretmanager.secretAccessor |
| agentest-mcp | MCP | cloudsql.client, secretmanager.secretAccessor |
| agentest-web | Web | (なし) |
| agentest-admin | Admin | (なし) |
| agentest-jobs | Jobs | cloudsql.client, secretmanager.secretAccessor |
| agentest-scheduler | Scheduler | run.invoker |

シークレットアクセスはリソースレベルで個別付与（プロジェクトレベルの広範な権限は付与しない）。

---

## 実装順序

### Phase 0: ブートストラップ
- `bootstrap/`: GCS tfstate バケット作成、GCP API 有効化（compute, sqladmin, redis, run, secretmanager, artifactregistry, cloudscheduler, servicenetworking, vpcaccess 等）
- Terraform 用サービスアカウント作成（手動）

### Phase 1: 基盤インフラ
1. `modules/iam` → サービスアカウント作成
2. `modules/networking` → VPC + サブネット + VPCコネクタ
3. `modules/cloud-sql` → PostgreSQL（VPC内、Private IP）
4. `modules/memorystore` → Redis（VPC内）
5. `modules/cloud-storage` → GCS バケット
6. `modules/artifact-registry` → Docker リポジトリ

### Phase 2: シークレット + Cloud Run サービス
1. `modules/secret-manager` → 全シークレット定義 + IAM
2. シークレット値の手動投入（`gcloud secrets versions add`）
3. Docker イメージビルド & Artifact Registry プッシュ
4. `modules/cloud-run-service` × 5 サービス（api, ws, mcp, web, admin）

### Phase 3: Load Balancer + CDN + Cloud Armor
1. `modules/load-balancer` → LB, URL Map, CDN, Cloud Armor, SSL証明書
2. DNS レコード設定
3. SSL 証明書プロビジョニング待ち

### Phase 4: バッチジョブ
1. `modules/cloud-run-job` → Job 定義 + Cloud Scheduler × 7 スケジュール

### Phase 5: staging 環境検証
- `environments/staging/` で `terraform plan` → `terraform apply`
- 各サービスの動作確認、Cloud Armor、CDN、バッチジョブ検証

### Phase 6: production 環境デプロイ
- staging 検証後に production 適用

---

## staging / production の主要差分

| リソース | staging | production |
|---------|---------|------------|
| Cloud SQL tier | db-f1-micro | db-custom-2-7680 |
| Cloud SQL HA | ZONAL | REGIONAL |
| Cloud SQL PITR | 無効 | 有効 |
| Redis tier | BASIC (1GB) | STANDARD_HA (5GB) |
| Cloud Run min_instances | 0（全サービス） | 1（全サービス） |
| VPC Connector | e2-micro | e2-small |
| deletion_protection | false | true |

**コスト見込み**: staging ~$80-120/月、production ~$400-600/月

---

## 重要な設計判断

1. **Cloud SQL 接続: Private IP + VPC Connector** を採用（Cloud SQL Auth Proxy ではなく）。Redis も同じ VPC コネクタで接続するため
2. **フロントエンド: Cloud Run + nginx** で配信（Cloud Storage 直接配信ではなく）。SPA フォールバックと既存 Dockerfile の活用
3. **GCP プロジェクト分離**: staging と production は別 GCP プロジェクト
4. **WebSocket**: Cloud Run Gen2 + always-on CPU + timeout 3600s + session_affinity

---

## 参照ファイル

| ファイル | 用途 |
|---------|------|
| `docker/docker-compose.yml` | サービス構成・環境変数・ポートの参照元 |
| `.env.example` | 全環境変数一覧、シークレット分類の基準 |
| `docs/operations/batch-jobs-runbook.md` | バッチジョブスケジュール・環境変数 |
| `docs/operations/secrets-management.md` | Secret Manager の設計パターン |
| `docs/guides/deployment.md` | デプロイフロー・Cloud Run 設定 |
| `docs/plans/production-readiness.md` | C-5, H-4 の要件定義 |
| `infrastructure/terraform/.gitkeep` | 現状（空ディレクトリ） |

---

## 検証方法

1. **terraform validate**: 各モジュールの構文検証
2. **terraform plan**: staging 環境で差分確認（リソース作成数の確認）
3. **terraform apply**: staging 環境にデプロイ
4. **サービス動作確認**:
   - 各 Cloud Run サービスの `/health` エンドポイント応答
   - API → Cloud SQL / Redis 接続確認
   - WebSocket 接続・メッセージ送受信
   - フロントエンド（Web/Admin）の表示確認
   - MCP サーバーの接続確認
5. **Cloud Armor**: 認証エンドポイントへのレートリミット発動テスト
6. **バッチジョブ**: `gcloud run jobs execute` で各ジョブの手動実行テスト
7. **CDN**: 静的ファイルのキャッシュヒット確認（`X-Cache` ヘッダー）
8. **SSL**: HTTPS 接続の証明書有効性確認
