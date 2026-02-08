-- セッション・リフレッシュトークンのハッシュ化マイグレーション
-- 既存の平文tokenをSHA-256ハッシュに変換し、tokenHash カラムに移行

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- refresh_tokens テーブル
-- ============================================

-- 新しいカラムを追加
ALTER TABLE "refresh_tokens" ADD COLUMN "token_hash" VARCHAR(64);

-- 既存データをハッシュ化
UPDATE "refresh_tokens" SET "token_hash" = encode(digest("token"::bytea, 'sha256'), 'hex');

-- NOT NULL制約を追加
ALTER TABLE "refresh_tokens" ALTER COLUMN "token_hash" SET NOT NULL;

-- 旧インデックスを削除
DROP INDEX IF EXISTS "refresh_tokens_token_key";
DROP INDEX IF EXISTS "refresh_tokens_token_idx";

-- 新しいユニーク制約を追加（UNIQUEが暗黙的にインデックスを作成するため別途CREATE INDEXは不要）
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash");

-- 旧カラムを削除
ALTER TABLE "refresh_tokens" DROP COLUMN "token";

-- ============================================
-- sessions テーブル
-- ============================================

ALTER TABLE "sessions" ADD COLUMN "token_hash" VARCHAR(64);

UPDATE "sessions" SET "token_hash" = encode(digest("token"::bytea, 'sha256'), 'hex');

ALTER TABLE "sessions" ALTER COLUMN "token_hash" SET NOT NULL;

DROP INDEX IF EXISTS "sessions_token_key";
DROP INDEX IF EXISTS "sessions_token_idx";

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_key" UNIQUE ("token_hash");

ALTER TABLE "sessions" DROP COLUMN "token";

-- ============================================
-- admin_sessions テーブル
-- ============================================

ALTER TABLE "admin_sessions" ADD COLUMN "token_hash" VARCHAR(64);

UPDATE "admin_sessions" SET "token_hash" = encode(digest("token"::bytea, 'sha256'), 'hex');

ALTER TABLE "admin_sessions" ALTER COLUMN "token_hash" SET NOT NULL;

DROP INDEX IF EXISTS "admin_sessions_token_key";
DROP INDEX IF EXISTS "admin_sessions_token_idx";

ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_token_hash_key" UNIQUE ("token_hash");

ALTER TABLE "admin_sessions" DROP COLUMN "token";
