-- AlterEnum: NotificationType から SECURITY_ALERT を削除
-- PostgreSQL の enum は直接値を削除できないため、新しい型を作成して置換する

-- 1. 新しい enum 型を作成
CREATE TYPE "NotificationType_new" AS ENUM ('ORG_INVITATION', 'INVITATION_ACCEPTED', 'PROJECT_ADDED', 'REVIEW_COMMENT', 'TEST_COMPLETED', 'TEST_FAILED');

-- 2. 既存カラムの型を変換
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TABLE "notification_preferences" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TABLE "organization_notification_settings" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");

-- 3. 旧 enum 型を削除し、新しい型をリネーム
DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
