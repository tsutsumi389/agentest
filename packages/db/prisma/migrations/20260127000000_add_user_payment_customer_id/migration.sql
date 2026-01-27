-- AlterTable
ALTER TABLE "users" ADD COLUMN     "payment_customer_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "users_payment_customer_id_key" ON "users"("payment_customer_id");
