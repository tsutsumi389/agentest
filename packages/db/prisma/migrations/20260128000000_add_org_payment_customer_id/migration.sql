-- DropIndex
DROP INDEX "organizations_slug_idx";

-- DropIndex
DROP INDEX "organizations_slug_key";

-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "slug",
ADD COLUMN     "payment_customer_id" VARCHAR(255);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "external_id" VARCHAR(255);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "payment_customer_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_payment_customer_id_key" ON "organizations"("payment_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_external_id_key" ON "subscriptions"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_payment_customer_id_key" ON "users"("payment_customer_id");
