# Runbook（運用手順書）

最終更新日: 2025年12月

## 概要

本ドキュメントは、Agentestの日常運用タスクと定型作業の手順をまとめたものです。

## 1. 日常運用タスク

### 1.1 毎日のチェック項目

| 時間 | タスク | 確認方法 |
|------|--------|---------|
| 9:00 | ステータスページ確認 | https://status.agentest.io |
| 9:00 | 夜間アラート確認 | Slack #alerts |
| 9:00 | エラーログ確認 | Datadog / Cloud Logging |
| 10:00 | バッチジョブ実行結果確認 | Cloud Console / Cloud Logging |
| 17:00 | 日次バックアップ確認 | Cloud Console |

### 1.2 毎週のタスク

| 曜日 | タスク |
|------|--------|
| 月 | 週次レポート確認（エラー率、レスポンスタイム） |
| 水 | 依存関係のセキュリティアップデート確認 |
| 金 | ディスク使用量確認 |

### 1.3 毎月のタスク

| 時期 | タスク |
|------|--------|
| 月初 | 前月のSLA実績レポート作成 |
| 月初 | コスト分析 |
| 第3日曜 | 定期メンテナンス |

## 2. サービス管理

### 2.1 サービス起動・停止

```bash
# ローカル開発環境
cd docker
docker compose up -d        # 起動
docker compose down         # 停止
docker compose restart api  # 特定サービス再起動

# 本番環境 (Cloud Run)
gcloud run services update agentest-api --no-traffic  # 停止
gcloud run services update agentest-api --traffic 100 # 起動
```

### 2.2 サービス状態確認

```bash
# ヘルスチェック
curl https://api.agentest.io/health

# 詳細ステータス
curl https://api.agentest.io/health/detailed

# Cloud Runリビジョン確認
gcloud run revisions list --service agentest-api
```

### 2.3 ログ確認

```bash
# ローカル
docker compose logs -f api
docker compose logs -f --tail=100 api

# 本番 (Cloud Logging)
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=agentest-api" \
  --limit=100 --format=json

# エラーログのみ
gcloud logging read "resource.type=cloud_run_revision \
  AND severity>=ERROR" --limit=50
```

## 3. データベース管理

### 3.1 接続確認

```bash
# ローカル
docker compose exec db psql -U agentest -d agentest

# 本番 (Cloud SQL Proxy経由)
cloud_sql_proxy -instances=PROJECT:REGION:agentest-db=tcp:5433 &
psql -h localhost -p 5433 -U agentest -d agentest
```

### 3.2 接続数確認

```sql
-- アクティブ接続数
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- 接続詳細
SELECT pid, usename, application_name, state, query_start
FROM pg_stat_activity
WHERE datname = 'agentest';
```

### 3.3 スロークエリ確認

```sql
-- 遅いクエリの特定
SELECT query, calls, mean_time, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 3.4 テーブルサイズ確認

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 10;
```

## 4. Redis管理

### 4.1 接続確認

```bash
# ローカル
docker compose exec redis redis-cli -a agentest ping

# 本番
redis-cli -h REDIS_HOST -p 6379 -a $REDIS_PASSWORD ping
```

### 4.2 メモリ使用量確認

```bash
redis-cli -a $REDIS_PASSWORD INFO memory | grep used_memory_human
```

### 4.3 キー統計

```bash
# キー数
redis-cli -a $REDIS_PASSWORD DBSIZE

# キーパターン確認（本番では注意）
redis-cli -a $REDIS_PASSWORD SCAN 0 MATCH "session:*" COUNT 100
```

### 4.4 キャッシュクリア

```bash
# 特定パターンのキー削除
redis-cli -a $REDIS_PASSWORD --scan --pattern "cache:*" | xargs redis-cli -a $REDIS_PASSWORD DEL

# 全キャッシュクリア（注意）
redis-cli -a $REDIS_PASSWORD FLUSHDB
```

## 5. ストレージ管理 (MinIO/S3)

### 5.1 バケット確認

```bash
# MinIO Client設定
mc alias set agentest http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

# バケット一覧
mc ls agentest

# 使用量確認
mc du agentest/evidence
```

### 5.2 ファイル操作

```bash
# ファイル一覧
mc ls agentest/evidence/

# ファイルダウンロード
mc cp agentest/evidence/file.png ./

# 古いファイル削除（30日以上前）
mc rm --recursive --older-than 30d agentest/temp/
```

## 6. デプロイ作業

### 6.1 通常デプロイ

```bash
# mainブランチへのマージでCI/CDが自動実行

# 手動トリガー
gh workflow run deploy.yml -f environment=production
```

### 6.2 ホットフィックス

```bash
# 1. ホットフィックスブランチ作成
git checkout -b hotfix/critical-fix main

# 2. 修正をコミット
git commit -m "fix: critical bug fix"

# 3. mainにマージ（PRスキップ可）
git checkout main
git merge hotfix/critical-fix
git push origin main

# 4. 自動デプロイ確認
gh run list --workflow=deploy.yml
```

### 6.3 ロールバック

```bash
# Cloud Runリビジョン確認
gcloud run revisions list --service agentest-api

# 前のリビジョンに戻す
gcloud run services update-traffic agentest-api \
  --to-revisions=agentest-api-00005-xyz=100

# 確認
gcloud run services describe agentest-api --format="value(status.traffic)"
```

## 7. マイグレーション

### 7.1 マイグレーション実行（本番）

```bash
# 1. バックアップ取得
gcloud sql backups create --instance=agentest-db --description="pre-migration"

# 2. マイグレーション実行
docker run --rm \
  -e DATABASE_URL=$PRODUCTION_DATABASE_URL \
  gcr.io/PROJECT_ID/agentest-api:latest \
  pnpm --filter @agentest/db prisma migrate deploy

# 3. 確認
docker run --rm \
  -e DATABASE_URL=$PRODUCTION_DATABASE_URL \
  gcr.io/PROJECT_ID/agentest-api:latest \
  pnpm --filter @agentest/db prisma migrate status
```

### 7.2 マイグレーション失敗時

```bash
# マイグレーション状態確認
prisma migrate status

# 失敗したマイグレーションを解決
prisma migrate resolve --rolled-back MIGRATION_NAME

# またはバックアップから復元
gcloud sql backups restore BACKUP_ID --restore-instance=agentest-db
```

## 8. ユーザーサポート対応

### 8.1 ユーザー情報確認

```sql
-- ユーザー検索
SELECT id, email, name, created_at, last_login_at
FROM users
WHERE email ILIKE '%example.com%';

-- 組織情報
SELECT o.id, o.name, o.plan, om.role
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = 'USER_ID';
```

### 8.2 アカウントロック解除

```sql
-- ログイン試行回数リセット
UPDATE users
SET failed_login_attempts = 0, locked_until = NULL
WHERE email = 'user@example.com';
```

### 8.3 データエクスポート（GDPR対応）

```bash
# ユーザーデータエクスポートスクリプト
docker compose exec api pnpm run export-user-data --user-id=USER_ID --output=/tmp/export.json
```

## 9. 定期メンテナンス

### 9.1 メンテナンス開始手順

1. ステータスページ更新（メンテナンス予告）
2. メンテナンスバナー表示
3. 新規リクエストの停止
4. 進行中の処理完了待機
5. メンテナンス作業実施

```bash
# メンテナンスモード有効化
redis-cli -a $REDIS_PASSWORD SET maintenance:enabled true

# Cloud Run トラフィック停止
gcloud run services update agentest-api --no-traffic
```

### 9.2 メンテナンス終了手順

1. 動作確認（ヘルスチェック）
2. トラフィック再開
3. メンテナンスモード解除
4. ステータスページ更新

```bash
# メンテナンスモード解除
redis-cli -a $REDIS_PASSWORD DEL maintenance:enabled

# トラフィック再開
gcloud run services update agentest-api --traffic 100

# ヘルスチェック
curl https://api.agentest.io/health
```

## 10. 緊急対応

### 10.1 サービス停止時

```bash
# 1. 状況確認
curl https://api.agentest.io/health
gcloud run services describe agentest-api

# 2. 最新ログ確認
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit=20

# 3. 再起動
gcloud run services update agentest-api --max-instances=10

# 4. 必要に応じてロールバック
```

### 10.2 データベース接続障害

```bash
# 1. Cloud SQL状態確認
gcloud sql instances describe agentest-db

# 2. 接続テスト
pg_isready -h CLOUD_SQL_IP -p 5432

# 3. フェイルオーバー（必要時）
gcloud sql instances failover agentest-db
```

### 10.3 高負荷時

```bash
# 1. 現在のインスタンス数確認
gcloud run services describe agentest-api --format="value(spec.template.spec.containerConcurrency)"

# 2. スケールアップ
gcloud run services update agentest-api \
  --min-instances=5 \
  --max-instances=50

# 3. レート制限強化
redis-cli -a $REDIS_PASSWORD SET rate_limit:global 50
```

## 11. バッチジョブ管理

バッチジョブは Cloud Run Jobs で実行されます。詳細は [バッチジョブ運用ガイド](./batch-jobs-runbook.md) を参照してください。

### 11.1 ジョブ実行状態確認

```bash
# ジョブ一覧
gcloud run jobs list

# 最近の実行履歴
gcloud run jobs executions list --job=agentest-jobs

# 特定の実行の詳細
gcloud run jobs executions describe EXECUTION_NAME --job=agentest-jobs
```

### 11.2 手動実行

```bash
# 履歴クリーンアップを手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=history-cleanup

# Webhook再処理を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=webhook-retry
```

### 11.3 ログ確認

```bash
# バッチジョブのログ
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=agentest-jobs" \
  --limit=100

# エラーログのみ
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=agentest-jobs \
  AND severity>=ERROR" \
  --limit=50
```

### 11.4 スケジュール確認・変更

```bash
# スケジュール一覧
gcloud scheduler jobs list --location=asia-northeast1

# スケジュール一時停止
gcloud scheduler jobs pause agentest-history-cleanup --location=asia-northeast1

# スケジュール再開
gcloud scheduler jobs resume agentest-history-cleanup --location=asia-northeast1
```

---

## 関連ドキュメント

- [インシデント対応](./incident-response.md)
- [バックアップ・リストア](./backup-restore.md)
- [監視・アラート](./monitoring.md)
- [バッチジョブ運用](./batch-jobs-runbook.md)
- [デプロイ手順](../guides/deployment.md)
