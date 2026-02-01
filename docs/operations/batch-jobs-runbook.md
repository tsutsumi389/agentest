# バッチジョブ運用ガイド

## 概要

Agentest のバッチジョブは Cloud Run Jobs で実行され、Cloud Scheduler によってスケジュール管理されます。
このドキュメントでは、日常運用からトラブルシューティングまでの手順を記載します。

## スケジュール一覧

| ジョブ名 | スケジュール | 目的 |
|---------|-------------|------|
| `history-cleanup` | 毎日 3:00 JST | FREE プランの古い履歴を削除 |
| `project-cleanup` | 毎日 4:00 JST | ソフトデリート済みプロジェクトを物理削除 |
| `webhook-retry` | 毎時 0分 | 失敗した決済 Webhook を再処理 |
| `payment-event-cleanup` | 毎週日曜 4:00 JST | 古い決済イベントを削除 |
| `subscription-sync` | 毎週日曜 5:00 JST | Stripe との状態を同期 |
| `metrics-aggregation` | 毎日 1:00 JST | DAU/WAU/MAUを集計 |
| `plan-distribution-aggregation` | 毎日 0:05 JST | プラン分布を集計 |

## 日常運用

### 1. 毎日のチェック項目

| 時間 | タスク | 確認方法 |
|------|--------|---------|
| 10:00 | バッチジョブ実行結果確認 | Cloud Console / Cloud Logging |

### 2. 実行状態の確認

```bash
# ジョブ一覧の確認
gcloud run jobs list

# 最近の実行履歴を確認
gcloud run jobs executions list --job=agentest-jobs

# 特定の実行の詳細を確認
gcloud run jobs executions describe EXECUTION_NAME --job=agentest-jobs
```

### 3. ログの確認

```bash
# 全バッチジョブのログ（最新100件）
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=agentest-jobs" \
  --limit=100 --format=json

# 特定ジョブのログ（JOB_NAME でフィルタ）
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=agentest-jobs \
  AND jsonPayload.message=~'history-cleanup'" \
  --limit=50

# エラーログのみ
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=agentest-jobs \
  AND severity>=ERROR" \
  --limit=50
```

### 4. Cloud Scheduler の確認

```bash
# スケジュールジョブ一覧
gcloud scheduler jobs list --location=asia-northeast1

# 特定ジョブの詳細
gcloud scheduler jobs describe agentest-history-cleanup --location=asia-northeast1
```

## 手動実行

### 緊急時や検証時の手動トリガー

```bash
# history-cleanup を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=history-cleanup

# webhook-retry を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=webhook-retry

# payment-event-cleanup を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=payment-event-cleanup

# subscription-sync を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=subscription-sync

# project-cleanup を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=project-cleanup

# metrics-aggregation を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=metrics-aggregation

# metrics-backfill を手動実行（過去3ヶ月分）
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=metrics-backfill,BACKFILL_MONTHS=3

# plan-distribution-aggregation を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=plan-distribution-aggregation
```

### 実行状態の監視

```bash
# 実行中のジョブを確認
gcloud run jobs executions list --job=agentest-jobs --filter="status.conditions.type:Running"

# リアルタイムログを確認
gcloud logging tail "resource.type=cloud_run_job AND resource.labels.job_name=agentest-jobs"
```

## トラブルシューティング

### 1. ジョブが失敗した場合

**症状**: Cloud Console でジョブが FAILED と表示される

**対応手順**:

```bash
# 1. エラーログを確認
gcloud logging read "resource.type=cloud_run_job \
  AND resource.labels.job_name=agentest-jobs \
  AND severity>=ERROR" \
  --limit=20

# 2. 失敗した実行の詳細を確認
gcloud run jobs executions describe EXECUTION_NAME --job=agentest-jobs

# 3. 必要に応じて手動で再実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=<ジョブ名>
```

### 2. webhook-retry で最大リトライ回数に達したイベントがある

**症状**: ログに「警告: N件のイベントが最大リトライ回数に達しました」と表示

**対応手順**:

```sql
-- 最大リトライ回数に達したイベントを確認
SELECT id, external_id, event_type, error_message, created_at
FROM payment_events
WHERE status = 'FAILED' AND retry_count >= 5
ORDER BY created_at DESC;

-- エラー内容を確認し、手動対応が必要か判断
-- 必要に応じて Stripe ダッシュボードで該当イベントを確認
```

### 3. subscription-sync で Stripe と不一致が多数検出された

**症状**: ログに大量の「不一致検出」が出力

**対応手順**:

```sql
-- 最近更新されたサブスクリプションを確認
SELECT id, user_id, organization_id, status, updated_at
FROM subscriptions
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- Stripe ダッシュボードで該当サブスクリプションの状態を確認
-- 意図しない変更がないか検証
```

### 4. history-cleanup でタイムアウトが発生

**症状**: ジョブが完了せずタイムアウト

**対応手順**:

```bash
# 1. タイムアウト設定を確認
gcloud run jobs describe agentest-jobs --format="value(spec.template.spec.timeoutSeconds)"

# 2. 必要に応じてタイムアウトを延長
gcloud run jobs update agentest-jobs --task-timeout=30m

# 3. 手動で再実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=history-cleanup
```

### 5. データベース接続エラー

**症状**: 「Connection refused」や「timeout」のエラー

**対応手順**:

```bash
# 1. Cloud SQL の状態を確認
gcloud sql instances describe agentest-db

# 2. 接続数を確認
gcloud sql connect agentest-db --user=agentest
# psql で実行:
# SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# 3. 問題が解消したら手動で再実行
```

### 6. metrics-aggregation でデータが集計されない

**症状**: ダッシュボードのアクティブユーザーグラフが更新されない

**対応手順**:

```sql
-- 最近の集計状況を確認
SELECT granularity, period_start, user_count, created_at
FROM active_user_metrics
ORDER BY period_start DESC
LIMIT 30;

-- 集計対象のセッションデータを確認
SELECT DATE(last_active_at) as date, COUNT(DISTINCT user_id) as active_count
FROM sessions
WHERE last_active_at > NOW() - INTERVAL '7 days'
  AND revoked_at IS NULL
GROUP BY DATE(last_active_at)
ORDER BY date DESC;
```

**復旧手順**:
1. ログでエラーを確認
2. 必要に応じてバックフィルジョブを実行

## データ確認クエリ

### 履歴クリーンアップ関連

```sql
-- FREE プランユーザーの古い履歴件数を確認
SELECT COUNT(*)
FROM test_case_histories tch
JOIN test_cases tc ON tc.id = tch.test_case_id
JOIN test_suites ts ON ts.id = tc.test_suite_id
JOIN projects p ON p.id = ts.project_id
JOIN project_members pm ON pm.project_id = p.id
JOIN users u ON u.id = pm.user_id
JOIN subscriptions s ON s.user_id = u.id
WHERE s.plan = 'FREE'
  AND p.organization_id IS NULL
  AND tch.created_at < NOW() - INTERVAL '30 days';
```

### Webhook 再処理関連

```sql
-- 失敗イベントの状況を確認
SELECT status, COUNT(*), AVG(retry_count) as avg_retries
FROM payment_events
GROUP BY status;

-- 直近の失敗イベント詳細
SELECT id, external_id, event_type, error_message, retry_count, created_at
FROM payment_events
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 20;
```

### サブスクリプション同期関連

```sql
-- externalId が設定されたアクティブなサブスクリプション
SELECT id, user_id, organization_id, external_id, status, plan, current_period_end
FROM subscriptions
WHERE external_id IS NOT NULL
  AND status != 'CANCELED'
ORDER BY updated_at DESC
LIMIT 50;
```

### 決済イベントクリーンアップ関連

```sql
-- 削除対象のイベント件数を確認
SELECT status, COUNT(*)
FROM payment_events
WHERE created_at < NOW() - INTERVAL '90 days'
GROUP BY status;
```

### メトリクス集計関連

```sql
-- 日次メトリクスの確認
SELECT period_start, user_count
FROM active_user_metrics
WHERE granularity = 'DAY'
ORDER BY period_start DESC
LIMIT 30;

-- 週次メトリクスの確認
SELECT period_start, user_count
FROM active_user_metrics
WHERE granularity = 'WEEK'
ORDER BY period_start DESC
LIMIT 12;

-- 月次メトリクスの確認
SELECT period_start, user_count
FROM active_user_metrics
WHERE granularity = 'MONTH'
ORDER BY period_start DESC
LIMIT 12;

-- 欠損している日付を確認
WITH date_series AS (
  SELECT generate_series(
    (SELECT MIN(period_start) FROM active_user_metrics WHERE granularity = 'DAY'),
    CURRENT_DATE - 1,
    '1 day'::interval
  )::date AS expected_date
)
SELECT expected_date
FROM date_series
WHERE expected_date NOT IN (
  SELECT period_start::date
  FROM active_user_metrics
  WHERE granularity = 'DAY'
);
```

### プラン分布集計関連

```sql
-- 日次プラン分布の確認
SELECT period_start, free_user_count, pro_user_count,
       team_org_count, enterprise_org_count,
       team_member_count, enterprise_member_count
FROM plan_distribution_metrics
WHERE granularity = 'DAY'
ORDER BY period_start DESC
LIMIT 30;

-- 週次プラン分布の確認
SELECT period_start, free_user_count, pro_user_count,
       team_org_count, enterprise_org_count,
       team_member_count, enterprise_member_count
FROM plan_distribution_metrics
WHERE granularity = 'WEEK'
ORDER BY period_start DESC
LIMIT 12;

-- 月次プラン分布の確認
SELECT period_start, free_user_count, pro_user_count,
       team_org_count, enterprise_org_count,
       team_member_count, enterprise_member_count
FROM plan_distribution_metrics
WHERE granularity = 'MONTH'
ORDER BY period_start DESC
LIMIT 12;

-- 欠損している日付を確認
WITH date_series AS (
  SELECT generate_series(
    (SELECT MIN(period_start) FROM plan_distribution_metrics WHERE granularity = 'DAY'),
    CURRENT_DATE - 1,
    '1 day'::interval
  )::date AS expected_date
)
SELECT expected_date
FROM date_series
WHERE expected_date NOT IN (
  SELECT period_start::date
  FROM plan_distribution_metrics
  WHERE granularity = 'DAY'
);
```

### プロジェクトクリーンアップ関連

```sql
-- 削除対象プロジェクト数を確認（30日以上前にソフトデリート）
SELECT COUNT(*)
FROM projects
WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days';

-- ソフトデリート済みプロジェクトの詳細を確認
SELECT id, name, deleted_at,
  (SELECT COUNT(*) FROM test_suites WHERE project_id = projects.id) as test_suite_count
FROM projects
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at ASC
LIMIT 20;
```

## アラート設定

### 推奨アラート

| 条件 | 閾値 | 通知先 | 優先度 |
|-----|------|-------|-------|
| ジョブ失敗 | 連続2回以上 | Slack #alerts | 高 |
| 実行時間超過 | 30分以上 | Slack #alerts | 中 |
| 最大リトライ到達 | 10件/日以上 | Slack #alerts | 中 |
| Stripe 不一致検出 | 50件/週以上 | Slack #alerts | 低 |

### Cloud Monitoring アラート設定例

```yaml
# ジョブ失敗アラート
displayName: "Batch Job Failed"
conditions:
  - conditionThreshold:
      filter: >
        resource.type="cloud_run_job"
        AND resource.labels.job_name="agentest-jobs"
        AND metric.type="run.googleapis.com/job/completed_execution_count"
        AND metric.labels.result="failed"
      comparison: COMPARISON_GT
      thresholdValue: 0
      duration: 0s
notificationChannels:
  - projects/PROJECT_ID/notificationChannels/CHANNEL_ID
```

## 環境変数

| 変数名 | 必須 | 説明 | 設定例 |
|--------|------|------|-------|
| `JOB_NAME` | Yes | 実行するジョブ名 | `history-cleanup` |
| `DATABASE_URL` | Yes | PostgreSQL 接続文字列 | Secret Manager 経由 |
| `REDIS_URL` | Yes | Redis 接続文字列 | Secret Manager 経由 |
| `STRIPE_SECRET_KEY` | No* | Stripe API キー | Secret Manager 経由 |
| `SMTP_HOST` | No* | SMTP サーバー | `smtp.sendgrid.net` |
| `SMTP_PORT` | No* | SMTP ポート | `587` |
| `SMTP_FROM` | No* | 送信元アドレス | `noreply@agentest.io` |

\* `subscription-sync` には `STRIPE_SECRET_KEY` が必要

## 関連ドキュメント

- [バッチ処理アーキテクチャ](../architecture/features/batch-processing.md) - 設計・実装詳細
- [デプロイ手順](../guides/deployment.md#cloud-run-jobs-バッチ処理) - デプロイ・設定
- [Runbook](./runbook.md) - 全体運用手順
- [監視・アラート](./monitoring.md) - メトリクス・ログ監視
