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
