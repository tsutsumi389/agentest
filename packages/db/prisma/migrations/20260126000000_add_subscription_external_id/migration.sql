-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "external_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_external_id_key" ON "subscriptions"("external_id");
