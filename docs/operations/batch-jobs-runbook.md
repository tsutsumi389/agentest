# バッチジョブ運用ガイド

## 概要

Agentest のバッチジョブは Cloud Run Jobs で実行され、Cloud Scheduler によってスケジュール管理されます。
このドキュメントでは、日常運用からトラブルシューティングまでの手順を記載します。

## スケジュール一覧

| ジョブ名 | スケジュール | 目的 |
|---------|-------------|------|
| `history-cleanup` | 毎日 3:00 JST | 古い履歴を削除 |
| `project-cleanup` | 毎日 4:00 JST | ソフトデリート済みプロジェクトを物理削除 |

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

# project-cleanup を手動実行
gcloud run jobs execute agentest-jobs \
  --region=asia-northeast1 \
  --set-env-vars JOB_NAME=project-cleanup


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

### 2. history-cleanup でタイムアウトが発生

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

### 3. データベース接続エラー

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

## データ確認クエリ

### 履歴クリーンアップ関連

```sql
-- 古い履歴件数を確認
SELECT COUNT(*)
FROM test_case_histories tch
WHERE tch.created_at < NOW() - INTERVAL '30 days';
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
| `SMTP_HOST` | No* | SMTP サーバー | `smtp.sendgrid.net` |
| `SMTP_PORT` | No* | SMTP ポート | `587` |
| `SMTP_FROM` | No* | 送信元アドレス | `noreply@agentest.io` |

## 関連ドキュメント

- [バッチ処理アーキテクチャ](../architecture/features/batch-processing.md) - 設計・実装詳細
- [デプロイ手順](../guides/deployment.md#cloud-run-jobs-バッチ処理) - デプロイ・設定
- [Runbook](./runbook.md) - 全体運用手順
- [監視・アラート](./monitoring.md) - メトリクス・ログ監視
