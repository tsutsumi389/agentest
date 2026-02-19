# OSS用 infrastructure ディレクトリの再構築

## Context

現在の `infrastructure/` はSaaS運用向け（staging/production 2環境、Stripe課金、MinIOシークレット等）に構成されている。OSSとして公開するにあたり、セルフホストユーザーが迷わずGCPにデプロイできるよう、不要なSaaS依存を除去し、シンプルなテンプレート構成に再構築する。合わせて `infrastructure/README.md` にGCPデプロイガイドを作成する。

## 変更方針（ユーザー確認済み）

| 項目 | 方針 |
|------|------|
| Stripe | **完全削除** - シークレット7個 + バッチジョブ3個 |
| MinIO | **シークレット削除** - GCS (Cloud Storage) で代替 |
| 環境構成 | **単一example環境** - staging/production → example (tfvars.example付き) |
| バッチジョブ | **2個のみ残す** - history-cleanup, project-cleanup |

## 変更サマリー

| 項目 | Before | After |
|------|--------|-------|
| シークレット | 24個 | 13個 |
| バッチジョブ | 7個 | 2個 |
| 環境 | staging + production | example (テンプレート) |
| スクリプト | ハードコード | パラメータ化 |

---

## Phase 1: Terraformモジュール修正

### 1.1 secret-manager/variables.tf
**ファイル:** `infrastructure/terraform/modules/secret-manager/variables.tf`

- `secret_ids` のデフォルトから以下を削除:
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_TEAM_YEARLY`
  - MinIO: `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`
- `secret_access_map` の更新:
  - `api`: Stripe 7個 + MinIO 4個を削除 → 13個に
  - `jobs`: `STRIPE_SECRET_KEY` を削除 → `DATABASE_URL`, `REDIS_URL` のみに
- `environment` の description から `（staging / production）` を削除

### 1.2 cloud-run-job/variables.tf
**ファイル:** `infrastructure/terraform/modules/cloud-run-job/variables.tf`

- `schedules` のデフォルトから5個削除:
  - 削除: `plan-distribution-aggregation`, `metrics-aggregation`, `webhook-retry`, `payment-event-cleanup`, `subscription-sync`
  - 残す: `history-cleanup`, `project-cleanup`
- `history-cleanup` の description を `"FREE プランの古い履歴削除"` → `"古い履歴レコードの削除"` に変更

---

## Phase 2: 環境ディレクトリの再構成

### 2.1 削除
- `infrastructure/terraform/environments/staging/` (全体)
- `infrastructure/terraform/environments/production/` (全体)
- `infrastructure/diagrams/` (空ディレクトリ)

### 2.2 新規作成: `environments/example/`

以下のファイルを新規作成（staging の main.tf をベースに調整）:

| ファイル | 内容 |
|---------|------|
| `providers.tf` | Google provider ~> 5.0, Terraform >= 1.5 |
| `backend.tf` | GCS backend, prefix = "env" |
| `variables.tf` | 汎用的な変数定義（region デフォルト asia-northeast1） |
| `main.tf` | 全モジュール統合（**Stripe/MinIO secret_env_vars 除去済み**） |
| `outputs.tf` | LB IP, Cloud SQL IP, Redis host, Artifact Registry URL 等 |
| `terraform.tfvars.example` | 全変数のドキュメント付きテンプレート |

**main.tf の主な変更点（staging比）:**
- `cloud_run_api` の `secret_env_vars` から Stripe 7個 + MinIO 4個を削除
- `cloud_run_api` の `env_vars` に `STORAGE_BUCKET` を追加（GCS バケット参照）
- `cloud_run_job` の `secret_env_vars` から `STRIPE_SECRET_KEY` を削除
- インラインコメントで必須/任意シークレットを明示
- Cloud SQL, Memorystore にスケールアップ方法のコメント追加

### 2.3 bootstrap/terraform.tfvars.example
**ファイル:** `infrastructure/terraform/bootstrap/terraform.tfvars.example`
- `project_id` と `region` のテンプレート

---

## Phase 3: スクリプトのパラメータ化

### 3.1 build-and-push.sh
**ファイル:** `infrastructure/scripts/build-and-push.sh`
- ハードコードされたプロジェクトID → 環境変数 `PROJECT_ID` (必須)
- `REGION`, `VITE_API_URL`, `VITE_WS_URL` も環境変数化
- `TFVARS_FILE` のデフォルトを `example/terraform.tfvars` に変更
- 必須変数は `${VAR:?メッセージ}` パターンでエラーハンドリング

### 3.2 init-secrets.sh
**ファイル:** `infrastructure/scripts/init-secrets.sh`
- Stripe 7個を削除 → 13個のシークレットのみ初期化
- `PROJECT_ID`, `PREFIX`, `ENVIRONMENT` をパラメータ化

### 3.3 update-secrets.sh
**ファイル:** `infrastructure/scripts/update-secrets.sh`
- Stripe 関連の処理を削除
- DB/Redis 接続情報を環境変数で受け取るよう変更
- JWT/暗号化キーは自動生成（`openssl rand -hex 32`）
- OAuth/SMTP は「後から個別設定」として案内

---

## Phase 4: ドキュメント作成

### 4.1 infrastructure/README.md（新規）
**ファイル:** `infrastructure/README.md`

GCP デプロイガイド（日本語）として以下のセクションを含む:
1. **概要** - ディレクトリ構成、使用GCPサービス一覧
2. **前提条件** - GCPアカウント, gcloud CLI, Terraform >= 1.5, Docker, ドメイン
3. **アーキテクチャ** - GCPサービス構成図（テキスト）
4. **デプロイ手順** (10ステップ):
   - GCPプロジェクト作成 → gcloud認証 → Bootstrap → イメージビルド&プッシュ → tfvars設定 → terraform apply → シークレット設定 → DBマイグレーション → DNS設定 → 動作確認
5. **コスト見積もり** - 小規模構成で月額 ~$80-110
6. **運用・メンテナンス** - イメージ更新、スケールアップ、バッチジョブ手動実行
7. **クリーンアップ** - terraform destroy の手順

### 4.2 terraform/README.md の更新
**ファイル:** `infrastructure/terraform/README.md`
- ディレクトリ構造を `example/` に更新
- シークレット一覧を13個に更新（Stripe/MinIO削除）
- 環境差分テーブルを削除
- `infrastructure/README.md` への参照を追加

---

## Phase 5: 軽微なクリーンアップ

以下のモジュールの `environment` variable description から `（staging / production）` を削除:
- `modules/cloud-run-service/variables.tf`
- `modules/cloud-run-migration/variables.tf`
- `modules/cloud-sql/variables.tf`
- `modules/cloud-storage/variables.tf`
- `modules/load-balancer/variables.tf`

`modules/cloud-storage/main.tf` のコメント `MinIO 代替` → `ファイルストレージ` に変更

---

## 対象ファイル一覧

### 修正 (6ファイル)
1. `infrastructure/terraform/modules/secret-manager/variables.tf`
2. `infrastructure/terraform/modules/cloud-run-job/variables.tf`
3. `infrastructure/scripts/build-and-push.sh`
4. `infrastructure/scripts/init-secrets.sh`
5. `infrastructure/scripts/update-secrets.sh`
6. `infrastructure/terraform/README.md`

### 新規作成 (8ファイル)
1. `infrastructure/terraform/environments/example/main.tf`
2. `infrastructure/terraform/environments/example/variables.tf`
3. `infrastructure/terraform/environments/example/providers.tf`
4. `infrastructure/terraform/environments/example/backend.tf`
5. `infrastructure/terraform/environments/example/outputs.tf`
6. `infrastructure/terraform/environments/example/terraform.tfvars.example`
7. `infrastructure/terraform/bootstrap/terraform.tfvars.example`
8. `infrastructure/README.md`

### 削除 (3ディレクトリ)
1. `infrastructure/terraform/environments/staging/`
2. `infrastructure/terraform/environments/production/`
3. `infrastructure/diagrams/`

### 軽微修正 (6ファイル - description変更のみ)
4. `infrastructure/terraform/modules/cloud-run-service/variables.tf`
5. `infrastructure/terraform/modules/cloud-run-migration/variables.tf`
6. `infrastructure/terraform/modules/cloud-sql/variables.tf`
7. `infrastructure/terraform/modules/cloud-storage/variables.tf`
8. `infrastructure/terraform/modules/cloud-storage/main.tf`
9. `infrastructure/terraform/modules/load-balancer/variables.tf`

---

## 検証方法

```bash
# Stripe参照が残っていないことを確認
grep -ri "stripe" infrastructure/

# MinIO参照が残っていないことを確認
grep -ri "minio" infrastructure/

# ハードコードされたプロジェクトIDが残っていないことを確認
grep -r "agentest-staging\|agentest-production" infrastructure/scripts/

# environments に example のみ存在することを確認
ls infrastructure/terraform/environments/

# terraform.tfvars.example が gitignore されていないことを確認
git check-ignore infrastructure/terraform/environments/example/terraform.tfvars.example

# Terraform バリデーション
cd infrastructure/terraform/environments/example
terraform init -backend=false
terraform validate
```
