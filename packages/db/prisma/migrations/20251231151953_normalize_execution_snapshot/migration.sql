-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'ADMIN', 'WRITE', 'READ');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TestCasePriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "PreconditionStatus" AS ENUM ('UNCHECKED', 'MET', 'NOT_MET');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "JudgmentStatus" AS ENUM ('PENDING', 'PASS', 'FAIL', 'SKIPPED', 'NOT_EXECUTABLE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('SUITE', 'CASE');

-- CreateEnum
CREATE TYPE "ReviewTargetField" AS ENUM ('TITLE', 'DESCRIPTION', 'PRECONDITION', 'STEP', 'EXPECTED_RESULT');

-- CreateEnum
CREATE TYPE "LockTargetType" AS ENUM ('SUITE', 'CASE');

-- CreateEnum
CREATE TYPE "AgentSessionStatus" AS ENUM ('ACTIVE', 'IDLE', 'ENDED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORG_INVITATION', 'INVITATION_ACCEPTED', 'PROJECT_ADDED', 'REVIEW_COMMENT', 'TEST_COMPLETED', 'TEST_FAILED', 'USAGE_ALERT', 'BILLING', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "AuditLogCategory" AS ENUM ('AUTH', 'USER', 'ORGANIZATION', 'MEMBER', 'PROJECT', 'API_TOKEN', 'BILLING');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "avatar_url" TEXT,
    "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "user_agent" TEXT,
    "ip_address" VARCHAR(45),
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "avatar_url" TEXT,
    "plan" "OrganizationPlan" NOT NULL DEFAULT 'TEAM',
    "billing_email" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "token" VARCHAR(255) NOT NULL,
    "invited_by_user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_environments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "base_url" TEXT,
    "description" VARCHAR(200),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'READ',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_histories" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_by_agent_session_id" TEXT,
    "change_type" "ChangeType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suites" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" TEXT,
    "created_by_agent_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suite_preconditions" (
    "id" TEXT NOT NULL,
    "test_suite_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_suite_preconditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_suite_histories" (
    "id" TEXT NOT NULL,
    "test_suite_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_by_agent_session_id" TEXT,
    "change_type" "ChangeType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_suite_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "test_suite_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "priority" "TestCasePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "EntityStatus" NOT NULL DEFAULT 'DRAFT',
    "order_key" VARCHAR(255) NOT NULL,
    "created_by_user_id" TEXT,
    "created_by_agent_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_preconditions" (
    "id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_case_preconditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_steps" (
    "id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_case_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_expected_results" (
    "id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_case_expected_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_histories" (
    "id" TEXT NOT NULL,
    "test_case_id" TEXT NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_by_agent_session_id" TEXT,
    "change_type" "ChangeType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_case_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL,
    "test_suite_id" TEXT NOT NULL,
    "environment_id" TEXT,
    "executed_by_user_id" TEXT,
    "executed_by_agent_session_id" TEXT,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_test_suites" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "original_test_suite_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_test_suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_test_suite_preconditions" (
    "id" TEXT NOT NULL,
    "execution_test_suite_id" TEXT NOT NULL,
    "original_precondition_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_test_suite_preconditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_test_cases" (
    "id" TEXT NOT NULL,
    "execution_test_suite_id" TEXT NOT NULL,
    "original_test_case_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "priority" "TestCasePriority" NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_test_case_preconditions" (
    "id" TEXT NOT NULL,
    "execution_test_case_id" TEXT NOT NULL,
    "original_precondition_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_test_case_preconditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_test_case_steps" (
    "id" TEXT NOT NULL,
    "execution_test_case_id" TEXT NOT NULL,
    "original_step_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_test_case_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_test_case_expected_results" (
    "id" TEXT NOT NULL,
    "execution_test_case_id" TEXT NOT NULL,
    "original_expected_result_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_test_case_expected_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_precondition_results" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "execution_test_case_id" TEXT,
    "execution_suite_precondition_id" TEXT,
    "execution_case_precondition_id" TEXT,
    "status" "PreconditionStatus" NOT NULL DEFAULT 'UNCHECKED',
    "checked_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_precondition_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_step_results" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "execution_test_case_id" TEXT NOT NULL,
    "execution_step_id" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "executed_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_step_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_expected_results" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "execution_test_case_id" TEXT NOT NULL,
    "execution_expected_result_id" TEXT NOT NULL,
    "status" "JudgmentStatus" NOT NULL DEFAULT 'PENDING',
    "judged_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_expected_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_evidences" (
    "id" TEXT NOT NULL,
    "expected_result_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" VARCHAR(100) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "description" TEXT,
    "uploaded_by_user_id" TEXT,
    "uploaded_by_agent_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "target_type" "ReviewTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_field" "ReviewTargetField" NOT NULL,
    "target_item_id" TEXT,
    "author_user_id" TEXT,
    "author_agent_session_id" TEXT,
    "content" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comment_replies" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "author_agent_session_id" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_comment_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edit_locks" (
    "id" TEXT NOT NULL,
    "target_type" "LockTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "locked_by_user_id" TEXT,
    "locked_by_agent_session_id" TEXT,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edit_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "client_name" VARCHAR(100),
    "status" "AgentSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'JPY',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "type" "PaymentMethodType" NOT NULL DEFAULT 'CARD',
    "external_id" VARCHAR(255) NOT NULL,
    "brand" VARCHAR(50),
    "last4" VARCHAR(4),
    "expiry_month" INTEGER,
    "expiry_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "token_prefix" VARCHAR(10) NOT NULL,
    "scopes" TEXT[],
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_notification_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "user_id" TEXT,
    "category" "AuditLogCategory" NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" TEXT,
    "details" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "mcp_sessions" INTEGER NOT NULL DEFAULT 0,
    "mcp_session_limit" INTEGER NOT NULL DEFAULT 0,
    "alert_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_provider_key" ON "accounts"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_deleted_at_idx" ON "organizations"("deleted_at");

-- CreateIndex
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_key" ON "organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_idx" ON "organization_invitations"("organization_id");

-- CreateIndex
CREATE INDEX "organization_invitations_token_idx" ON "organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations"("email");

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

-- CreateIndex
CREATE INDEX "project_environments_project_id_idx" ON "project_environments"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_environments_project_id_slug_key" ON "project_environments"("project_id", "slug");

-- CreateIndex
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_histories_project_id_idx" ON "project_histories"("project_id");

-- CreateIndex
CREATE INDEX "project_histories_created_at_idx" ON "project_histories"("created_at");

-- CreateIndex
CREATE INDEX "test_suites_project_id_idx" ON "test_suites"("project_id");

-- CreateIndex
CREATE INDEX "test_suites_status_idx" ON "test_suites"("status");

-- CreateIndex
CREATE INDEX "test_suites_deleted_at_idx" ON "test_suites"("deleted_at");

-- CreateIndex
CREATE INDEX "test_suite_preconditions_test_suite_id_idx" ON "test_suite_preconditions"("test_suite_id");

-- CreateIndex
CREATE INDEX "test_suite_preconditions_test_suite_id_order_key_idx" ON "test_suite_preconditions"("test_suite_id", "order_key");

-- CreateIndex
CREATE INDEX "test_suite_histories_test_suite_id_idx" ON "test_suite_histories"("test_suite_id");

-- CreateIndex
CREATE INDEX "test_suite_histories_created_at_idx" ON "test_suite_histories"("created_at");

-- CreateIndex
CREATE INDEX "test_cases_test_suite_id_idx" ON "test_cases"("test_suite_id");

-- CreateIndex
CREATE INDEX "test_cases_test_suite_id_order_key_idx" ON "test_cases"("test_suite_id", "order_key");

-- CreateIndex
CREATE INDEX "test_cases_status_idx" ON "test_cases"("status");

-- CreateIndex
CREATE INDEX "test_cases_deleted_at_idx" ON "test_cases"("deleted_at");

-- CreateIndex
CREATE INDEX "test_case_preconditions_test_case_id_idx" ON "test_case_preconditions"("test_case_id");

-- CreateIndex
CREATE INDEX "test_case_preconditions_test_case_id_order_key_idx" ON "test_case_preconditions"("test_case_id", "order_key");

-- CreateIndex
CREATE INDEX "test_case_steps_test_case_id_idx" ON "test_case_steps"("test_case_id");

-- CreateIndex
CREATE INDEX "test_case_steps_test_case_id_order_key_idx" ON "test_case_steps"("test_case_id", "order_key");

-- CreateIndex
CREATE INDEX "test_case_expected_results_test_case_id_idx" ON "test_case_expected_results"("test_case_id");

-- CreateIndex
CREATE INDEX "test_case_expected_results_test_case_id_order_key_idx" ON "test_case_expected_results"("test_case_id", "order_key");

-- CreateIndex
CREATE INDEX "test_case_histories_test_case_id_idx" ON "test_case_histories"("test_case_id");

-- CreateIndex
CREATE INDEX "test_case_histories_created_at_idx" ON "test_case_histories"("created_at");

-- CreateIndex
CREATE INDEX "executions_test_suite_id_idx" ON "executions"("test_suite_id");

-- CreateIndex
CREATE INDEX "executions_status_idx" ON "executions"("status");

-- CreateIndex
CREATE INDEX "executions_started_at_idx" ON "executions"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "execution_test_suites_execution_id_key" ON "execution_test_suites"("execution_id");

-- CreateIndex
CREATE INDEX "execution_test_suite_preconditions_execution_test_suite_id_idx" ON "execution_test_suite_preconditions"("execution_test_suite_id");

-- CreateIndex
CREATE INDEX "execution_test_suite_preconditions_execution_test_suite_id__idx" ON "execution_test_suite_preconditions"("execution_test_suite_id", "order_key");

-- CreateIndex
CREATE INDEX "execution_test_cases_execution_test_suite_id_idx" ON "execution_test_cases"("execution_test_suite_id");

-- CreateIndex
CREATE INDEX "execution_test_cases_execution_test_suite_id_order_key_idx" ON "execution_test_cases"("execution_test_suite_id", "order_key");

-- CreateIndex
CREATE INDEX "execution_test_case_preconditions_execution_test_case_id_idx" ON "execution_test_case_preconditions"("execution_test_case_id");

-- CreateIndex
CREATE INDEX "execution_test_case_preconditions_execution_test_case_id_or_idx" ON "execution_test_case_preconditions"("execution_test_case_id", "order_key");

-- CreateIndex
CREATE INDEX "execution_test_case_steps_execution_test_case_id_idx" ON "execution_test_case_steps"("execution_test_case_id");

-- CreateIndex
CREATE INDEX "execution_test_case_steps_execution_test_case_id_order_key_idx" ON "execution_test_case_steps"("execution_test_case_id", "order_key");

-- CreateIndex
CREATE INDEX "exec_tc_expected_results_test_case_id_idx" ON "execution_test_case_expected_results"("execution_test_case_id");

-- CreateIndex
CREATE INDEX "exec_tc_expected_results_test_case_id_order_key_idx" ON "execution_test_case_expected_results"("execution_test_case_id", "order_key");

-- CreateIndex
CREATE INDEX "execution_precondition_results_execution_id_idx" ON "execution_precondition_results"("execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "execution_precondition_results_execution_id_execution_suite_key" ON "execution_precondition_results"("execution_id", "execution_suite_precondition_id");

-- CreateIndex
CREATE UNIQUE INDEX "execution_precondition_results_execution_id_execution_case__key" ON "execution_precondition_results"("execution_id", "execution_case_precondition_id");

-- CreateIndex
CREATE INDEX "execution_step_results_execution_id_idx" ON "execution_step_results"("execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "execution_step_results_execution_id_execution_step_id_key" ON "execution_step_results"("execution_id", "execution_step_id");

-- CreateIndex
CREATE INDEX "execution_expected_results_execution_id_idx" ON "execution_expected_results"("execution_id");

-- CreateIndex
CREATE UNIQUE INDEX "execution_expected_results_execution_id_execution_expected__key" ON "execution_expected_results"("execution_id", "execution_expected_result_id");

-- CreateIndex
CREATE INDEX "execution_evidences_expected_result_id_idx" ON "execution_evidences"("expected_result_id");

-- CreateIndex
CREATE INDEX "review_comments_target_type_target_id_idx" ON "review_comments"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "review_comments_target_type_target_id_target_field_target_i_idx" ON "review_comments"("target_type", "target_id", "target_field", "target_item_id");

-- CreateIndex
CREATE INDEX "review_comment_replies_comment_id_idx" ON "review_comment_replies"("comment_id");

-- CreateIndex
CREATE INDEX "edit_locks_expires_at_idx" ON "edit_locks"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "edit_locks_target_type_target_id_key" ON "edit_locks"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "agent_sessions_project_id_idx" ON "agent_sessions"("project_id");

-- CreateIndex
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions"("status");

-- CreateIndex
CREATE INDEX "agent_sessions_last_heartbeat_idx" ON "agent_sessions"("last_heartbeat");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "payment_methods_user_id_idx" ON "payment_methods"("user_id");

-- CreateIndex
CREATE INDEX "payment_methods_organization_id_idx" ON "payment_methods"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");

-- CreateIndex
CREATE INDEX "api_tokens_organization_id_idx" ON "api_tokens"("organization_id");

-- CreateIndex
CREATE INDEX "api_tokens_token_hash_idx" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_key" ON "notification_preferences"("user_id", "type");

-- CreateIndex
CREATE INDEX "organization_notification_settings_organization_id_idx" ON "organization_notification_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_notification_settings_organization_id_type_key" ON "organization_notification_settings"("organization_id", "type");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "usage_records_user_id_idx" ON "usage_records"("user_id");

-- CreateIndex
CREATE INDEX "usage_records_organization_id_idx" ON "usage_records"("organization_id");

-- CreateIndex
CREATE INDEX "usage_records_period_start_idx" ON "usage_records"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_user_id_period_start_key" ON "usage_records"("user_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_organization_id_period_start_key" ON "usage_records"("organization_id", "period_start");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_environments" ADD CONSTRAINT "project_environments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_histories" ADD CONSTRAINT "project_histories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_histories" ADD CONSTRAINT "project_histories_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_histories" ADD CONSTRAINT "project_histories_changed_by_agent_session_id_fkey" FOREIGN KEY ("changed_by_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suites" ADD CONSTRAINT "test_suites_created_by_agent_session_id_fkey" FOREIGN KEY ("created_by_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_preconditions" ADD CONSTRAINT "test_suite_preconditions_test_suite_id_fkey" FOREIGN KEY ("test_suite_id") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_histories" ADD CONSTRAINT "test_suite_histories_test_suite_id_fkey" FOREIGN KEY ("test_suite_id") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_histories" ADD CONSTRAINT "test_suite_histories_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_suite_histories" ADD CONSTRAINT "test_suite_histories_changed_by_agent_session_id_fkey" FOREIGN KEY ("changed_by_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_test_suite_id_fkey" FOREIGN KEY ("test_suite_id") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_created_by_agent_session_id_fkey" FOREIGN KEY ("created_by_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_preconditions" ADD CONSTRAINT "test_case_preconditions_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_steps" ADD CONSTRAINT "test_case_steps_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_expected_results" ADD CONSTRAINT "test_case_expected_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_histories" ADD CONSTRAINT "test_case_histories_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_histories" ADD CONSTRAINT "test_case_histories_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_histories" ADD CONSTRAINT "test_case_histories_changed_by_agent_session_id_fkey" FOREIGN KEY ("changed_by_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_test_suite_id_fkey" FOREIGN KEY ("test_suite_id") REFERENCES "test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "project_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_executed_by_user_id_fkey" FOREIGN KEY ("executed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_executed_by_agent_session_id_fkey" FOREIGN KEY ("executed_by_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_test_suites" ADD CONSTRAINT "execution_test_suites_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_test_suite_preconditions" ADD CONSTRAINT "execution_test_suite_preconditions_execution_test_suite_id_fkey" FOREIGN KEY ("execution_test_suite_id") REFERENCES "execution_test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_test_cases" ADD CONSTRAINT "execution_test_cases_execution_test_suite_id_fkey" FOREIGN KEY ("execution_test_suite_id") REFERENCES "execution_test_suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_test_case_preconditions" ADD CONSTRAINT "execution_test_case_preconditions_execution_test_case_id_fkey" FOREIGN KEY ("execution_test_case_id") REFERENCES "execution_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_test_case_steps" ADD CONSTRAINT "execution_test_case_steps_execution_test_case_id_fkey" FOREIGN KEY ("execution_test_case_id") REFERENCES "execution_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_test_case_expected_results" ADD CONSTRAINT "execution_test_case_expected_results_execution_test_case_i_fkey" FOREIGN KEY ("execution_test_case_id") REFERENCES "execution_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_precondition_results" ADD CONSTRAINT "execution_precondition_results_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_precondition_results" ADD CONSTRAINT "execution_precondition_results_execution_test_case_id_fkey" FOREIGN KEY ("execution_test_case_id") REFERENCES "execution_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_precondition_results" ADD CONSTRAINT "execution_precondition_results_execution_suite_preconditio_fkey" FOREIGN KEY ("execution_suite_precondition_id") REFERENCES "execution_test_suite_preconditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_precondition_results" ADD CONSTRAINT "execution_precondition_results_execution_case_precondition_fkey" FOREIGN KEY ("execution_case_precondition_id") REFERENCES "execution_test_case_preconditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_step_results" ADD CONSTRAINT "execution_step_results_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_step_results" ADD CONSTRAINT "execution_step_results_execution_test_case_id_fkey" FOREIGN KEY ("execution_test_case_id") REFERENCES "execution_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_step_results" ADD CONSTRAINT "execution_step_results_execution_step_id_fkey" FOREIGN KEY ("execution_step_id") REFERENCES "execution_test_case_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_expected_results" ADD CONSTRAINT "execution_expected_results_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_expected_results" ADD CONSTRAINT "execution_expected_results_execution_test_case_id_fkey" FOREIGN KEY ("execution_test_case_id") REFERENCES "execution_test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_expected_results" ADD CONSTRAINT "execution_expected_results_execution_expected_result_id_fkey" FOREIGN KEY ("execution_expected_result_id") REFERENCES "execution_test_case_expected_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_evidences" ADD CONSTRAINT "execution_evidences_expected_result_id_fkey" FOREIGN KEY ("expected_result_id") REFERENCES "execution_expected_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_evidences" ADD CONSTRAINT "execution_evidences_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_evidences" ADD CONSTRAINT "execution_evidences_uploaded_by_agent_session_id_fkey" FOREIGN KEY ("uploaded_by_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_author_agent_session_id_fkey" FOREIGN KEY ("author_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment_replies" ADD CONSTRAINT "review_comment_replies_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "review_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment_replies" ADD CONSTRAINT "review_comment_replies_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment_replies" ADD CONSTRAINT "review_comment_replies_author_agent_session_id_fkey" FOREIGN KEY ("author_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_locks" ADD CONSTRAINT "edit_locks_locked_by_user_id_fkey" FOREIGN KEY ("locked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edit_locks" ADD CONSTRAINT "edit_locks_locked_by_agent_session_id_fkey" FOREIGN KEY ("locked_by_agent_session_id") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_notification_settings" ADD CONSTRAINT "organization_notification_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
