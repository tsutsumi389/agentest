-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "payment_customer_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_payment_customer_id_key" ON "organizations"("payment_customer_id");
