# デプロイ手順

## 環境

| 環境 | 用途 | URL |
|-----|------|-----|
| Development | ローカル開発 | localhost |
| Staging | テスト・検証 | staging.agentest.example.com |
| Production | 本番 | agentest.example.com |

## インフラ構成

```
┌─────────────────────────────────────────────────────────┐
│                    Cloud Provider                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ Cloud Run   │    │ Cloud SQL   │    │   Cloud     │ │
│  │ (API/WS)    │    │ (PostgreSQL)│    │   Storage   │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│                                                         │
│  ┌─────────────┐    ┌─────────────┐                    │
│  │ Cloud CDN   │    │ Memorystore │                    │
│  │ (Web/Admin) │    │ (Redis)     │                    │
│  └─────────────┘    └─────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## デプロイフロー

```
main ブランチへのマージ
        │
        ▼
  GitHub Actions
        │
        ├── Lint & Test
        │
        ├── Build Docker Images
        │
        ├── Push to Container Registry
        │
        └── Deploy to Cloud Run
```

## 手動デプロイ（緊急時）

### 1. Docker イメージのビルド

```bash
# API
docker build -f docker/Dockerfile.api -t gcr.io/PROJECT_ID/agentest-api:latest .

# Web
docker build -f docker/Dockerfile.web --target production -t gcr.io/PROJECT_ID/agentest-web:latest .
```

### 2. イメージのプッシュ

```bash
docker push gcr.io/PROJECT_ID/agentest-api:latest
docker push gcr.io/PROJECT_ID/agentest-web:latest
```

### 3. Cloud Run へのデプロイ

```bash
gcloud run deploy agentest-api \
  --image gcr.io/PROJECT_ID/agentest-api:latest \
  --region asia-northeast1 \
  --platform managed
```

## Cloud Run Jobs (バッチ処理)

`apps/jobs` はバッチ処理用の Cloud Run Jobs アプリケーションです。
Cloud Scheduler と連携して定期的なデータメンテナンスを実行します。

### 1. Docker イメージのビルド

```bash
docker build -f apps/jobs/Dockerfile -t gcr.io/PROJECT_ID/agentest-jobs:latest .
```

### 2. イメージのプッシュ

```bash
docker push gcr.io/PROJECT_ID/agentest-jobs:latest
```

### 3. Cloud Run Job の作成

```bash
gcloud run jobs create agentest-jobs \
  --image gcr.io/PROJECT_ID/agentest-jobs:latest \
  --region asia-northeast1 \
  --task-timeout=30m \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest \
  --set-env-vars SMTP_HOST=smtp.sendgrid.net,SMTP_PORT=587,SMTP_FROM=noreply@agentest.io
```

### 4. Cloud Scheduler 設定

各ジョブのスケジュールを Cloud Scheduler で設定します。

| ジョブ名 | cron 式 | 環境変数 |
|---------|---------|---------|
| history-cleanup | `0 3 * * *` (毎日 3:00 JST) | `JOB_NAME=history-cleanup` |
| history-expiry-notify | `0 9 * * *` (毎日 9:00 JST) | `JOB_NAME=history-expiry-notify` |
| webhook-retry | `0 * * * *` (毎時 0分) | `JOB_NAME=webhook-retry` |
| payment-event-cleanup | `0 4 * * 0` (毎週日曜 4:00 JST) | `JOB_NAME=payment-event-cleanup` |
| subscription-sync | `0 5 * * 0` (毎週日曜 5:00 JST) | `JOB_NAME=subscription-sync` |

```bash
# history-cleanup
gcloud scheduler jobs create http agentest-history-cleanup \
  --location=asia-northeast1 \
  --schedule="0 3 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/agentest-jobs:run" \
  --http-method=POST \
  --oauth-service-account-email=SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com \
  --message-body='{"overrides":{"containerOverrides":[{"env":[{"name":"JOB_NAME","value":"history-cleanup"}]}]}}'

# history-expiry-notify
gcloud scheduler jobs create http agentest-history-expiry-notify \
  --location=asia-northeast1 \
  --schedule="0 9 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/agentest-jobs:run" \
  --http-method=POST \
  --oauth-service-account-email=SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com \
  --message-body='{"overrides":{"containerOverrides":[{"env":[{"name":"JOB_NAME","value":"history-expiry-notify"}]}]}}'

# webhook-retry
gcloud scheduler jobs create http agentest-webhook-retry \
  --location=asia-northeast1 \
  --schedule="0 * * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/agentest-jobs:run" \
  --http-method=POST \
  --oauth-service-account-email=SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com \
  --message-body='{"overrides":{"containerOverrides":[{"env":[{"name":"JOB_NAME","value":"webhook-retry"}]}]}}'

# payment-event-cleanup
gcloud scheduler jobs create http agentest-payment-event-cleanup \
  --location=asia-northeast1 \
  --schedule="0 4 * * 0" \
  --time-zone="Asia/Tokyo" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/agentest-jobs:run" \
  --http-method=POST \
  --oauth-service-account-email=SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com \
  --message-body='{"overrides":{"containerOverrides":[{"env":[{"name":"JOB_NAME","value":"payment-event-cleanup"}]}]}}'

# subscription-sync
gcloud scheduler jobs create http agentest-subscription-sync \
  --location=asia-northeast1 \
  --schedule="0 5 * * 0" \
  --time-zone="Asia/Tokyo" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/agentest-jobs:run" \
  --http-method=POST \
  --oauth-service-account-email=SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com \
  --message-body='{"overrides":{"containerOverrides":[{"env":[{"name":"JOB_NAME","value":"subscription-sync"}]}]}}'
```

### 5. ジョブの更新

```bash
gcloud run jobs update agentest-jobs \
  --image gcr.io/PROJECT_ID/agentest-jobs:latest \
  --region asia-northeast1
```

### 6. 手動実行（動作確認）

```bash
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=history-cleanup
```

詳細は [バッチジョブ運用ガイド](../operations/batch-jobs-runbook.md) を参照してください。

## マイグレーション

本番環境のマイグレーションは慎重に実行：

```bash
# 1. バックアップ取得
gcloud sql backups create --instance=agentest-db

# 2. マイグレーション実行
docker run --rm \
  -e DATABASE_URL=$PRODUCTION_DATABASE_URL \
  gcr.io/PROJECT_ID/agentest-api:latest \
  pnpm --filter @agentest/db prisma migrate deploy
```

## ロールバック

### アプリケーション

```bash
# 前のリビジョンに戻す
gcloud run services update-traffic agentest-api \
  --to-revisions=agentest-api-00001-abc=100
```

### データベース

```bash
# バックアップから復元
gcloud sql backups restore BACKUP_ID \
  --restore-instance=agentest-db
```

## 環境変数

本番環境の環境変数は Secret Manager で管理：

```bash
# シークレット作成
echo -n "secret-value" | gcloud secrets create JWT_SECRET --data-file=-

# Cloud Run から参照
gcloud run services update agentest-api \
  --set-secrets=JWT_SECRET=JWT_SECRET:latest
```

## モニタリング

| 項目 | ツール |
|-----|-------|
| ログ | Cloud Logging |
| メトリクス | Cloud Monitoring |
| エラー追跡 | Sentry |
| APM | Cloud Trace |

## アラート設定

| 条件 | 閾値 | 通知先 |
|-----|------|-------|
| エラー率 | > 1% | Slack |
| レイテンシ | p99 > 1s | Slack |
| CPU 使用率 | > 80% | Slack |

## 関連ドキュメント

- [システム全体像](../architecture/overview.md)
- [開発フロー](./development.md)
