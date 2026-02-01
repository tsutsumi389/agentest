-- CreateTable
CREATE TABLE "plan_distribution_metrics" (
    "id" TEXT NOT NULL,
    "granularity" "MetricGranularity" NOT NULL,
    "period_start" DATE NOT NULL,
    "free_user_count" INTEGER NOT NULL DEFAULT 0,
    "pro_user_count" INTEGER NOT NULL DEFAULT 0,
    "team_org_count" INTEGER NOT NULL DEFAULT 0,
    "team_member_count" INTEGER NOT NULL DEFAULT 0,
    "enterprise_org_count" INTEGER NOT NULL DEFAULT 0,
    "enterprise_member_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_distribution_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_distribution_metrics_granularity_period_start_idx" ON "plan_distribution_metrics"("granularity", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "plan_distribution_metrics_granularity_period_start_key" ON "plan_distribution_metrics"("granularity", "period_start");
