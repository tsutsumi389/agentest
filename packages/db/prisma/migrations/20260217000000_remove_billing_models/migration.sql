-- OSS移行: 課金関連モデル・enum・カラムの削除
-- 注意: 本番環境では適用前にデータのバックアップを推奨

-- AlterEnum: AuditLogCategoryからBILLINGを削除
BEGIN;
CREATE TYPE "AuditLogCategory_new" AS ENUM ('AUTH', 'USER', 'ORGANIZATION', 'MEMBER', 'PROJECT', 'API_TOKEN');
ALTER TABLE "audit_logs" ALTER COLUMN "category" TYPE "AuditLogCategory_new" USING ("category"::text::"AuditLogCategory_new");
ALTER TYPE "AuditLogCategory" RENAME TO "AuditLogCategory_old";
ALTER TYPE "AuditLogCategory_new" RENAME TO "AuditLogCategory";
DROP TYPE "public"."AuditLogCategory_old";
COMMIT;

-- AlterEnum: NotificationTypeからUSAGE_ALERT, BILLINGを削除
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('ORG_INVITATION', 'INVITATION_ACCEPTED', 'PROJECT_ADDED', 'REVIEW_COMMENT', 'TEST_COMPLETED', 'TEST_FAILED', 'SECURITY_ALERT');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TABLE "notification_preferences" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TABLE "organization_notification_settings" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_subscription_id_fkey";

ALTER TABLE "payment_methods" DROP CONSTRAINT "payment_methods_organization_id_fkey";

ALTER TABLE "payment_methods" DROP CONSTRAINT "payment_methods_user_id_fkey";

ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_organization_id_fkey";

ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_fkey";

ALTER TABLE "usage_records" DROP CONSTRAINT "usage_records_organization_id_fkey";

ALTER TABLE "usage_records" DROP CONSTRAINT "usage_records_user_id_fkey";

-- DropIndex
DROP INDEX "organizations_payment_customer_id_key";

DROP INDEX "users_payment_customer_id_key";

-- AlterTable: organizationsから課金カラムを削除
ALTER TABLE "organizations" DROP COLUMN "billing_email",
DROP COLUMN "payment_customer_id",
DROP COLUMN "plan";

-- AlterTable: usersから課金カラムを削除
ALTER TABLE "users" DROP COLUMN "payment_customer_id",
DROP COLUMN "plan";

-- DropTable: 課金関連テーブルの削除
DROP TABLE "invoices";

DROP TABLE "payment_events";

DROP TABLE "payment_methods";

DROP TABLE "plan_distribution_metrics";

DROP TABLE "subscriptions";

DROP TABLE "usage_records";

-- DropEnum: 課金関連enumの削除
DROP TYPE "BillingCycle";

DROP TYPE "InvoiceStatus";

DROP TYPE "OrganizationPlan";

DROP TYPE "PaymentEventStatus";

DROP TYPE "PaymentMethodType";

DROP TYPE "SubscriptionPlan";

DROP TYPE "SubscriptionStatus";

DROP TYPE "UserPlan";
