-- CreateTable
CREATE TABLE "admin_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_password_reset_tokens_token_hash_key" ON "admin_password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_admin_user_id_idx" ON "admin_password_reset_tokens"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_expires_at_idx" ON "admin_password_reset_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "admin_password_reset_tokens" ADD CONSTRAINT "admin_password_reset_tokens_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
