-- Executionテーブルからstatus, started_at, completed_atフィールドを削除
-- statusインデックスを削除
DROP INDEX IF EXISTS "executions_status_idx";

-- started_atインデックスを削除
DROP INDEX IF EXISTS "executions_started_at_idx";

-- カラムを削除
ALTER TABLE "executions" DROP COLUMN IF EXISTS "status";
ALTER TABLE "executions" DROP COLUMN IF EXISTS "started_at";
ALTER TABLE "executions" DROP COLUMN IF EXISTS "completed_at";

-- created_atにインデックスを追加
CREATE INDEX "executions_created_at_idx" ON "executions"("created_at");

-- ExecutionStatus enumを削除
DROP TYPE IF EXISTS "ExecutionStatus";
