/**
 * バッチジョブのエントリーポイント
 * JOB_NAME環境変数で実行するジョブを振り分ける
 */
import { runHistoryCleanup } from './jobs/history-cleanup.js';
import { runWebhookRetry } from './jobs/webhook-retry.js';
import { runPaymentEventCleanup } from './jobs/payment-event-cleanup.js';
import { runSubscriptionSync } from './jobs/subscription-sync.js';
import { runProjectCleanup } from './jobs/project-cleanup.js';
import { runMetricsAggregation } from './jobs/metrics-aggregation.js';
import { runMetricsBackfill } from './jobs/metrics-backfill.js';
import { runPlanDistributionAggregation } from './jobs/plan-distribution-aggregation.js';
import { closeRedis } from './lib/redis.js';
import { closePrisma } from './lib/prisma.js';
import { registerProcessHandlers } from '@agentest/shared';
import { logger } from './utils/logger.js';

// リソースクリーンアップ
async function cleanup() {
  try {
    await closeRedis();
    await closePrisma();
  } catch {
    // クリーンアップ中のエラーは無視（既にプロセス終了処理中）
  }
}

// プロセスレベルの例外ハンドラ（main実行前に登録）
registerProcessHandlers({
  getShutdownFn: () => async (_signal, exitCode = 1) => {
    await cleanup().catch(() => {});
    process.exit(exitCode);
  },
  logger,
});

// 利用可能なジョブの定義
const jobs: Record<string, () => Promise<void>> = {
  'history-cleanup': runHistoryCleanup,
  'webhook-retry': runWebhookRetry,
  'payment-event-cleanup': runPaymentEventCleanup,
  'subscription-sync': runSubscriptionSync,
  'project-cleanup': runProjectCleanup,
  'metrics-aggregation': runMetricsAggregation,
  'metrics-backfill': runMetricsBackfill,
  'plan-distribution-aggregation': runPlanDistributionAggregation,
};

async function main() {
  const jobName = process.env.JOB_NAME;

  if (!jobName || !jobs[jobName]) {
    logger.error({ jobName, availableJobs: Object.keys(jobs) }, '不明なジョブ');
    process.exit(1);
  }

  logger.info({ jobName }, 'ジョブ開始');
  const startTime = Date.now();

  try {
    await jobs[jobName]();
    const duration = Date.now() - startTime;
    logger.info({ jobName, duration }, 'ジョブが正常に完了しました');
  } catch (error) {
    logger.error({ err: error, jobName }, 'ジョブが失敗しました');
    process.exit(1);
  } finally {
    // リソースのクリーンアップ
    await cleanup();
  }

  process.exit(0);
}

main();
