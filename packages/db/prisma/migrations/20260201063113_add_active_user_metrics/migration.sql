-- CreateEnum
CREATE TYPE "MetricGranularity" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateTable
CREATE TABLE "active_user_metrics" (
    "id" TEXT NOT NULL,
    "granularity" "MetricGranularity" NOT NULL,
    "period_start" DATE NOT NULL,
    "user_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_user_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "active_user_metrics_granularity_period_start_idx" ON "active_user_metrics"("granularity", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "active_user_metrics_granularity_period_start_key" ON "active_user_metrics"("granularity", "period_start");
