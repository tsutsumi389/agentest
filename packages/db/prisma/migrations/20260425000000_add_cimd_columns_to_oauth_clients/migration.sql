-- CIMD (Client ID Metadata Document, draft-ietf-oauth-client-id-metadata-document-00) サポート用カラム追加
-- 既存DCRクライアントには影響しないよう、すべてnullableかデフォルト値付きで追加する

-- AlterTable
ALTER TABLE "oauth_clients"
    ADD COLUMN "is_cimd" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "metadata_url" VARCHAR(2048),
    ADD COLUMN "metadata_fetched_at" TIMESTAMP(3),
    ADD COLUMN "metadata_expires_at" TIMESTAMP(3),
    ADD COLUMN "metadata_etag" VARCHAR(255),
    ADD COLUMN "jwks_uri" TEXT;
