# データベース運用ガイド

最終更新日: 2025年12月

## 1. 概要

本ドキュメントは、AgentestのPostgreSQLデータベースの運用・管理手順を説明します。

## 2. データベース構成

### 2.1 環境別構成

| 環境 | サービス | スペック |
|------|---------|---------|
| Development | Docker (postgres:16-alpine) | 512MB RAM |
| Staging | Cloud SQL | db-f1-micro |
| Production | Cloud SQL | db-custom-2-4096 |

### 2.2 接続情報

```bash
# ローカル開発
DATABASE_URL=postgresql://agentest:agentest@localhost:5432/agentest

# 本番（Cloud SQL Proxy経由）
DATABASE_URL=postgresql://agentest:$DB_PASSWORD@localhost:5433/agentest
```

## 3. 接続管理

### 3.1 ローカル接続

```bash
# Docker経由
docker compose exec db psql -U agentest -d agentest

# 直接接続
psql postgresql://agentest:agentest@localhost:5432/agentest
```

### 3.2 本番接続（Cloud SQL）

```bash
# Cloud SQL Proxyを起動
cloud_sql_proxy -instances=PROJECT:REGION:agentest-db=tcp:5433 &

# 接続
psql -h localhost -p 5433 -U agentest -d agentest

# パスワードはSecret Managerから取得
gcloud secrets versions access latest --secret=DB_PASSWORD
```

### 3.3 接続プール設定

```typescript
// packages/db/src/client.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // 接続プール設定
  // connection_limit: 接続数上限
  // pool_timeout: 接続待機タイムアウト
});
```

**推奨設定（Cloud Run）**:
```
DATABASE_URL=postgresql://...?connection_limit=10&pool_timeout=10
```

## 4. マイグレーション

### 4.1 マイグレーション作成

```bash
# 変更を検出してマイグレーション生成
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name add_user_avatar

# 生成されるファイル
# packages/db/prisma/migrations/20251226100000_add_user_avatar/migration.sql
```

### 4.2 マイグレーション適用

```bash
# 開発環境
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev

# 本番環境
docker compose exec dev pnpm --filter @agentest/db prisma migrate deploy
```

### 4.3 マイグレーション状態確認

```bash
docker compose exec dev pnpm --filter @agentest/db prisma migrate status
```

### 4.4 マイグレーションのロールバック

```bash
# 特定のマイグレーションを解決済みとしてマーク
docker compose exec dev pnpm --filter @agentest/db prisma migrate resolve --rolled-back 20251226100000_add_user_avatar

# DBを以前の状態に戻す場合はバックアップからリストア
```

### 4.5 本番マイグレーションの手順

```bash
# 1. バックアップ取得
gcloud sql backups create --instance=agentest-db --description="pre-migration"

# 2. メンテナンスモード開始（オプション）
redis-cli SET maintenance:enabled true

# 3. マイグレーション実行
docker run --rm \
  -e DATABASE_URL=$PRODUCTION_DATABASE_URL \
  gcr.io/PROJECT/agentest-api:latest \
  pnpm --filter @agentest/db prisma migrate deploy

# 4. 確認
docker run --rm \
  -e DATABASE_URL=$PRODUCTION_DATABASE_URL \
  gcr.io/PROJECT/agentest-api:latest \
  pnpm --filter @agentest/db prisma migrate status

# 5. メンテナンスモード解除
redis-cli DEL maintenance:enabled
```

## 5. パフォーマンス監視

### 5.1 接続数監視

```sql
-- アクティブ接続数
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';

-- 状態別接続数
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state;

-- 接続元別
SELECT client_addr, count(*)
FROM pg_stat_activity
GROUP BY client_addr
ORDER BY count(*) DESC;
```

### 5.2 スロークエリ検出

```sql
-- pg_stat_statements 有効化（postgresql.conf）
-- shared_preload_libraries = 'pg_stat_statements'

-- スロークエリ上位10件
SELECT
  query,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as avg_ms,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 5.3 テーブル統計

```sql
-- テーブルサイズ
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size,
  pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename::regclass)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- 行数推定
SELECT
  relname as table,
  reltuples::bigint as estimated_rows
FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY reltuples DESC;
```

### 5.4 インデックス使用状況

```sql
-- 未使用インデックス
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- インデックススキャン率
SELECT
  relname,
  seq_scan,
  idx_scan,
  round(100.0 * idx_scan / nullif(seq_scan + idx_scan, 0), 2) as idx_scan_pct
FROM pg_stat_user_tables
WHERE seq_scan + idx_scan > 0
ORDER BY seq_scan DESC;
```

## 6. インデックス管理

### 6.1 インデックス追加

```sql
-- オンラインでインデックス作成（ロックなし）
CREATE INDEX CONCURRENTLY idx_test_cases_project_id
ON test_cases(project_id);

-- 複合インデックス
CREATE INDEX CONCURRENTLY idx_executions_project_status
ON executions(project_id, status);

-- 部分インデックス
CREATE INDEX CONCURRENTLY idx_test_cases_active
ON test_cases(project_id)
WHERE deleted_at IS NULL;
```

### 6.2 インデックス削除

```sql
-- 未使用インデックスの削除
DROP INDEX CONCURRENTLY IF EXISTS idx_unused_index;
```

### 6.3 インデックス再構築

```sql
-- インデックスの膨張解消
REINDEX INDEX CONCURRENTLY idx_test_cases_project_id;

-- テーブルの全インデックス再構築
REINDEX TABLE CONCURRENTLY test_cases;
```

## 7. メンテナンス

### 7.1 VACUUM

```sql
-- 手動VACUUM（通常は自動実行）
VACUUM ANALYZE test_cases;

-- テーブルの膨張確認
SELECT
  relname,
  n_dead_tup,
  n_live_tup,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) as dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### 7.2 ANALYZE

```sql
-- 統計情報更新
ANALYZE test_cases;

-- 全テーブル
ANALYZE;
```

### 7.3 自動VACUUM設定確認

```sql
-- autovacuum設定
SHOW autovacuum;
SHOW autovacuum_vacuum_threshold;
SHOW autovacuum_analyze_threshold;

-- テーブル別設定確認
SELECT
  relname,
  reloptions
FROM pg_class
WHERE reloptions IS NOT NULL;
```

## 8. データ管理

### 8.1 データエクスポート

```bash
# テーブル単位
pg_dump -h $DB_HOST -U agentest -d agentest \
  --table=users \
  --format=custom \
  --file=users_backup.dump

# CSV出力
psql -h $DB_HOST -U agentest -d agentest \
  -c "\COPY users TO '/tmp/users.csv' WITH CSV HEADER"
```

### 8.2 データインポート

```bash
# dump形式
pg_restore -h $DB_HOST -U agentest -d agentest \
  --data-only \
  users_backup.dump

# CSV
psql -h $DB_HOST -U agentest -d agentest \
  -c "\COPY users FROM '/tmp/users.csv' WITH CSV HEADER"
```

### 8.3 データクリーンアップ

```sql
-- ソフトデリートされた古いデータを物理削除
DELETE FROM test_cases
WHERE deleted_at < NOW() - INTERVAL '90 days';

-- 古いセッションデータ削除
DELETE FROM sessions
WHERE expires_at < NOW() - INTERVAL '30 days';

-- 古い監査ログのアーカイブ
INSERT INTO audit_logs_archive
SELECT * FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

## 9. レプリケーション

### 9.1 リードレプリカ設定（Cloud SQL）

```bash
# リードレプリカ作成
gcloud sql instances create agentest-db-replica \
  --master-instance-name=agentest-db \
  --region=asia-northeast1

# レプリカ接続情報
gcloud sql instances describe agentest-db-replica \
  --format="value(ipAddresses.ipAddress)"
```

### 9.2 レプリケーション遅延確認

```sql
-- プライマリで確認
SELECT
  client_addr,
  state,
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) as lag_bytes
FROM pg_stat_replication;
```

### 9.3 アプリケーションでの使い分け

```typescript
// packages/db/src/client.ts
import { PrismaClient } from '@prisma/client';

// 書き込み用（プライマリ）
export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

// 読み取り用（レプリカ）
export const prismaRead = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_REPLICA_URL },
  },
});
```

## 10. セキュリティ

### 10.1 ユーザー権限管理

```sql
-- アプリケーション用ユーザー（最小権限）
CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE agentest TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 読み取り専用ユーザー
CREATE ROLE readonly_user WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE agentest TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
```

### 10.2 接続制限

```sql
-- 特定IPからのみ接続許可（pg_hba.conf）
-- host    agentest    app_user    10.0.0.0/8    scram-sha-256
```

### 10.3 監査ログ

```sql
-- pgaudit拡張（有効化が必要）
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- 監査設定
ALTER SYSTEM SET pgaudit.log = 'write, ddl';
ALTER SYSTEM SET pgaudit.log_level = 'log';
SELECT pg_reload_conf();
```

## 11. トラブルシューティング

### 11.1 ロック確認

```sql
-- ロック待ち確認
SELECT
  blocked.pid AS blocked_pid,
  blocked.query AS blocked_query,
  blocking.pid AS blocking_pid,
  blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks blocked_locks ON blocked.pid = blocked_locks.pid
JOIN pg_locks blocking_locks ON blocked_locks.locktype = blocking_locks.locktype
  AND blocked_locks.database = blocking_locks.database
  AND blocked_locks.relation = blocking_locks.relation
  AND blocked_locks.page = blocking_locks.page
  AND blocked_locks.tuple = blocking_locks.tuple
  AND blocked_locks.virtualxid = blocking_locks.virtualxid
  AND blocked_locks.transactionid = blocking_locks.transactionid
  AND blocked_locks.classid = blocking_locks.classid
  AND blocked_locks.objid = blocking_locks.objid
  AND blocked_locks.objsubid = blocking_locks.objsubid
  AND blocked_locks.pid != blocking_locks.pid
JOIN pg_stat_activity blocking ON blocking_locks.pid = blocking.pid
WHERE NOT blocked_locks.granted;
```

### 11.2 長時間実行クエリの強制終了

```sql
-- クエリ確認
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 minutes';

-- クエリキャンセル（ソフト）
SELECT pg_cancel_backend(PID);

-- 接続切断（ハード）
SELECT pg_terminate_backend(PID);
```

### 11.3 接続数上限エラー

```sql
-- 現在の接続数と上限
SELECT
  count(*) as current,
  (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max
FROM pg_stat_activity;

-- アイドル接続の切断
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND query_start < now() - interval '1 hour';
```

---

## 関連ドキュメント

- [Runbook](./runbook.md)
- [バックアップ・リストア](./backup-restore.md)
- [監視・アラート](./monitoring.md)
- [DBスキーマ設計](../architecture/database/)
