-- Phase 1: データベースマイグレーション
-- NOT_EXECUTABLE を JudgmentStatus から削除する

-- 1. 既存の NOT_EXECUTABLE データを SKIPPED に変換
UPDATE "execution_expected_results" SET "status" = 'SKIPPED' WHERE "status" = 'NOT_EXECUTABLE';

-- 2. 新しい JudgmentStatus enum を作成（NOT_EXECUTABLE を含まない）
CREATE TYPE "JudgmentStatus_new" AS ENUM ('PENDING', 'PASS', 'FAIL', 'SKIPPED');

-- 3. デフォルト値を一旦削除
ALTER TABLE "execution_expected_results" ALTER COLUMN "status" DROP DEFAULT;

-- 4. カラムの型を新しい enum に変更
ALTER TABLE "execution_expected_results"
    ALTER COLUMN "status" TYPE "JudgmentStatus_new"
    USING ("status"::text::"JudgmentStatus_new");

-- 5. 古い enum を削除
DROP TYPE "JudgmentStatus";

-- 6. 新しい enum をリネーム
ALTER TYPE "JudgmentStatus_new" RENAME TO "JudgmentStatus";

-- 7. デフォルト値を再設定
ALTER TABLE "execution_expected_results" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"JudgmentStatus";
