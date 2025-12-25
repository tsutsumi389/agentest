# バックアップ・リストア手順

最終更新日: 2025年12月

## 1. 概要

本ドキュメントは、Agentestのデータバックアップとリストア（復旧）手順を説明します。

## 2. バックアップ対象

| 対象 | 重要度 | バックアップ頻度 | 保持期間 |
|------|--------|-----------------|---------|
| PostgreSQL | Critical | 毎日 + 継続的 | 30日 |
| Redis | Medium | 毎日 | 7日 |
| オブジェクトストレージ | High | リアルタイム複製 | 無期限 |
| 設定ファイル | Medium | 変更時 | 無期限 |
| シークレット | Critical | 変更時 | 世代管理 |

## 3. PostgreSQL バックアップ

### 3.1 自動バックアップ（Cloud SQL）

```yaml
# Cloud SQL設定
backup:
  enabled: true
  startTime: "03:00"  # JST 12:00 (UTC 03:00)
  location: "asia-northeast1"
  retentionDays: 30
  pointInTimeRecovery: true
  transactionLogRetentionDays: 7
```

### 3.2 オンデマンドバックアップ

```bash
# バックアップ作成
gcloud sql backups create \
  --instance=agentest-db \
  --description="Pre-migration backup $(date +%Y%m%d)"

# バックアップ一覧
gcloud sql backups list --instance=agentest-db

# バックアップ詳細
gcloud sql backups describe BACKUP_ID --instance=agentest-db
```

### 3.3 論理バックアップ（pg_dump）

```bash
# フルバックアップ
pg_dump -h $DB_HOST -U $DB_USER -d agentest \
  --format=custom \
  --file=backup_$(date +%Y%m%d_%H%M%S).dump

# スキーマのみ
pg_dump -h $DB_HOST -U $DB_USER -d agentest \
  --schema-only \
  --file=schema_$(date +%Y%m%d).sql

# 特定テーブルのみ
pg_dump -h $DB_HOST -U $DB_USER -d agentest \
  --table=users \
  --table=organizations \
  --file=users_orgs_$(date +%Y%m%d).dump
```

### 3.4 リストア

#### Cloud SQLからのリストア

```bash
# バックアップからリストア（同一インスタンス）
gcloud sql backups restore BACKUP_ID \
  --restore-instance=agentest-db

# 新規インスタンスへリストア
gcloud sql instances clone agentest-db agentest-db-restored \
  --point-in-time="2025-12-26T10:00:00Z"
```

#### pg_restoreによるリストア

```bash
# 既存DBへリストア
pg_restore -h $DB_HOST -U $DB_USER -d agentest \
  --clean --if-exists \
  backup_20251226.dump

# 新規DBへリストア
createdb -h $DB_HOST -U $DB_USER agentest_restored
pg_restore -h $DB_HOST -U $DB_USER -d agentest_restored \
  backup_20251226.dump
```

### 3.5 ポイントインタイムリカバリ

```bash
# 特定時点への復旧
gcloud sql instances clone agentest-db agentest-db-pitr \
  --point-in-time="2025-12-26T14:30:00+09:00"

# 復旧後の確認
gcloud sql connect agentest-db-pitr --user=agentest
```

## 4. Redis バックアップ

### 4.1 RDBスナップショット

```bash
# 手動スナップショット作成
redis-cli -a $REDIS_PASSWORD BGSAVE

# スナップショット状態確認
redis-cli -a $REDIS_PASSWORD LASTSAVE
```

### 4.2 AOF（Append Only File）

```yaml
# redis.conf
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### 4.3 リストア

```bash
# 1. Redisを停止
docker compose stop redis

# 2. dump.rdbを配置
cp backup/dump.rdb /var/lib/redis/dump.rdb

# 3. Redis再起動
docker compose start redis

# 4. データ確認
redis-cli -a $REDIS_PASSWORD DBSIZE
```

## 5. オブジェクトストレージ（MinIO/S3）

### 5.1 バケット複製設定

```bash
# MinIO: バケットレプリケーション
mc admin bucket remote add agentest/evidence \
  https://backup-minio.example.com/evidence-backup \
  --service replication

# レプリケーションルール設定
mc replicate add agentest/evidence \
  --remote-bucket evidence-backup \
  --replicate "delete,delete-marker"
```

### 5.2 手動バックアップ

```bash
# バケット同期
mc mirror agentest/evidence s3/backup-bucket/evidence/

# 特定日のファイルのみ
mc find agentest/evidence --newer-than 1d | \
  xargs -I {} mc cp {} s3/backup-bucket/evidence/
```

### 5.3 リストア

```bash
# 全ファイル復元
mc mirror s3/backup-bucket/evidence/ agentest/evidence/

# 特定ファイル復元
mc cp s3/backup-bucket/evidence/file.png agentest/evidence/
```

## 6. 設定・シークレットバックアップ

### 6.1 シークレットエクスポート

```bash
# Secret Managerからエクスポート（暗号化必須）
gcloud secrets versions access latest --secret=JWT_SECRET | \
  gpg --encrypt --recipient admin@agentest.io > secrets/jwt_secret.gpg

# 全シークレット一覧
gcloud secrets list --format="value(name)" > secrets/secret_names.txt
```

### 6.2 環境変数バックアップ

```bash
# Cloud Run環境変数エクスポート
gcloud run services describe agentest-api \
  --format="yaml(spec.template.spec.containers[0].env)" \
  > config/api_env.yaml
```

### 6.3 Terraformステート

```bash
# リモートバックエンドを使用
terraform {
  backend "gcs" {
    bucket = "agentest-terraform-state"
    prefix = "production"
  }
}

# ステートのバックアップ
gsutil cp gs://agentest-terraform-state/production/default.tfstate \
  gs://agentest-terraform-backup/$(date +%Y%m%d)/
```

## 7. 災害復旧手順

### 7.1 DR計画概要

| シナリオ | RTO | RPO | 対応 |
|---------|-----|-----|------|
| 単一サービス障害 | 15分 | 0 | 自動復旧/再デプロイ |
| リージョン障害 | 4時間 | 1時間 | DRサイト切替 |
| データ破損 | 4時間 | 15分 | PITR |
| 完全データ損失 | 24時間 | 24時間 | バックアップリストア |

### 7.2 リージョン障害時の復旧

```bash
# 1. DRリージョンでのDB復旧
gcloud sql instances create agentest-db-dr \
  --region=asia-northeast2 \
  --source-ip-address=SOURCE_INSTANCE_IP \
  --replica-type=FAILOVER

# 2. アプリケーションデプロイ
gcloud run deploy agentest-api \
  --region=asia-northeast2 \
  --image=gcr.io/PROJECT/agentest-api:latest

# 3. DNS切替
gcloud dns record-sets update api.agentest.io \
  --zone=agentest \
  --type=A \
  --rrdatas=DR_REGION_IP
```

### 7.3 復旧確認チェックリスト

- [ ] データベース接続確認
- [ ] ヘルスチェック通過
- [ ] 認証フロー動作確認
- [ ] テストケースCRUD確認
- [ ] WebSocket接続確認
- [ ] 外部連携（OAuth等）確認

## 8. バックアップ検証

### 8.1 定期検証スケジュール

| 検証項目 | 頻度 | 担当 |
|---------|------|------|
| バックアップ成功確認 | 毎日 | 自動 |
| リストアテスト | 月次 | インフラチーム |
| DR訓練 | 半年 | 全チーム |

### 8.2 リストアテスト手順

```bash
# 1. テスト環境準備
gcloud sql instances create agentest-db-test \
  --source-instance=agentest-db

# 2. 最新バックアップからリストア
gcloud sql backups restore LATEST_BACKUP_ID \
  --restore-instance=agentest-db-test

# 3. データ整合性確認
psql -h TEST_DB_HOST -U agentest -d agentest <<EOF
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM test_cases;
SELECT MAX(created_at) FROM executions;
EOF

# 4. テスト環境削除
gcloud sql instances delete agentest-db-test
```

### 8.3 検証レポート

```markdown
## バックアップ検証レポート

**実施日**: 2025-12-26
**担当者**: インフラチーム

### 結果サマリ
| 項目 | 結果 | 備考 |
|------|------|------|
| DBリストア | OK | 所要時間: 15分 |
| データ整合性 | OK | レコード数一致 |
| アプリ起動 | OK | ヘルスチェック通過 |

### 改善事項
- リストア手順書の更新が必要
```

## 9. 自動化スクリプト

### 9.1 バックアップスクリプト

```bash
#!/bin/bash
# scripts/backup.sh

set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/${DATE}"

echo "Starting backup: ${DATE}"

# PostgreSQL
echo "Backing up PostgreSQL..."
gcloud sql backups create \
  --instance=agentest-db \
  --description="Automated backup ${DATE}"

# Redis
echo "Backing up Redis..."
redis-cli -a $REDIS_PASSWORD BGSAVE

# オブジェクトストレージ
echo "Syncing object storage..."
mc mirror agentest/evidence s3/backup-bucket/evidence/${DATE}/

echo "Backup completed: ${DATE}"

# 通知
curl -X POST "$SLACK_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Backup completed: ${DATE}\"}"
```

### 9.2 GitHub Actions ワークフロー

```yaml
name: Scheduled Backup

on:
  schedule:
    - cron: '0 18 * * *'  # JST 3:00

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Create DB Backup
        run: |
          gcloud sql backups create \
            --instance=agentest-db \
            --description="Scheduled backup $(date +%Y%m%d)"

      - name: Verify Backup
        run: |
          gcloud sql backups list \
            --instance=agentest-db \
            --limit=1

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Daily backup completed successfully"
            }
```

---

## 関連ドキュメント

- [Runbook](./runbook.md)
- [インシデント対応](./incident-response.md)
- [SLA](./sla.md)
- [デプロイ手順](../guides/deployment.md)
