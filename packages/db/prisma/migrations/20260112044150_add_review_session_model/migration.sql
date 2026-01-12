/*
  Warnings:

  - Added the required column `review_id` to the `review_comments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReviewSessionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('APPROVED', 'CHANGES_REQUESTED', 'COMMENT_ONLY');

-- AlterTable
ALTER TABLE "review_comments" ADD COLUMN     "review_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "test_case_histories" ADD COLUMN     "group_id" VARCHAR(36);

-- AlterTable
ALTER TABLE "test_suite_histories" ADD COLUMN     "group_id" VARCHAR(36);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "test_suite_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "author_agent_session_id" TEXT,
    "status" "ReviewSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "verdict" "ReviewVerdict",
    "summary" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "client_secret" VARCHAR(255),
    "client_secret_expires_at" TIMESTAMP(3),
    "client_id_issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_name" VARCHAR(100) NOT NULL,
    "client_uri" TEXT,
    "logo_uri" TEXT,
    "redirect_uris" TEXT[],
    "grant_types" TEXT[] DEFAULT ARRAY['authorization_code']::TEXT[],
    "response_types" TEXT[] DEFAULT ARRAY['code']::TEXT[],
    "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "software_id" VARCHAR(255),
    "software_version" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_authorization_codes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[],
    "code_challenge" VARCHAR(128) NOT NULL,
    "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
    "resource" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_access_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scopes" TEXT[],
    "audience" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refresh_token_id" TEXT,

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_refresh_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scopes" TEXT[],
    "audience" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_test_suite_id_idx" ON "reviews"("test_suite_id");

-- CreateIndex
CREATE INDEX "reviews_test_suite_id_status_idx" ON "reviews"("test_suite_id", "status");

-- CreateIndex
CREATE INDEX "reviews_author_user_id_idx" ON "reviews"("author_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_authorization_codes_code_key" ON "oauth_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "oauth_authorization_codes_code_idx" ON "oauth_authorization_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_tokens_token_hash_key" ON "oauth_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_user_id_idx" ON "oauth_access_tokens"("user_id");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_refresh_token_id_idx" ON "oauth_access_tokens"("refresh_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_refresh_tokens_token_hash_key" ON "oauth_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "oauth_refresh_tokens_user_id_idx" ON "oauth_refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "review_comments_review_id_idx" ON "review_comments"("review_id");

-- CreateIndex
CREATE INDEX "test_case_histories_test_case_id_group_id_idx" ON "test_case_histories"("test_case_id", "group_id");

-- CreateIndex
CREATE INDEX "test_suite_histories_test_suite_id_group_id_idx" ON "test_suite_histories"("test_suite_id", "group_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_test_suite_id_fkey" FOREIGN KEY ("test_suite_id") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_agent_session_id_fkey" FOREIGN KEY ("author_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_refresh_token_id_fkey" FOREIGN KEY ("refresh_token_id") REFERENCES "oauth_refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
