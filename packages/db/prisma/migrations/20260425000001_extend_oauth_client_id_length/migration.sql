-- CIMD では client_id が HTTPS URL となるため、関連テーブルの client_id 列を VARCHAR(2048) へ拡張する
-- VARCHAR の長さ拡張のみで型変更を伴わないため、PostgreSQL ではメタデータ更新のみで完了する

-- 親テーブル (VARCHAR(255) → VARCHAR(2048))
ALTER TABLE "oauth_clients"
    ALTER COLUMN "client_id" TYPE VARCHAR(2048);

-- 子テーブル (TEXT → VARCHAR(2048))
ALTER TABLE "oauth_authorization_codes"
    ALTER COLUMN "client_id" TYPE VARCHAR(2048);

ALTER TABLE "oauth_access_tokens"
    ALTER COLUMN "client_id" TYPE VARCHAR(2048);

ALTER TABLE "oauth_refresh_tokens"
    ALTER COLUMN "client_id" TYPE VARCHAR(2048);
