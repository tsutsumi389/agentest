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
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: 'キャッチされない例外が発生しました',
    error: error.message,
    stack: error.stack,
  }));
  // ベストエフォートでクリーンアップし、確実に終了する
  cleanup()
    .catch(() => {})
    .finally(() => process.exit(1));
  // クリーンアップがハングした場合のセーフティネット
  setTimeout(() => process.exit(1), 5000).unref();
});

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: '未処理のPromise拒否が発生しました',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  }));
  cleanup()
    .catch(() => {})
    .finally(() => process.exit(1));
  setTimeout(() => process.exit(1), 5000).unref();
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
    console.error(`不明なジョブ: ${jobName}`);
    console.error(`利用可能なジョブ: ${Object.keys(jobs).join(', ')}`);
    process.exit(1);
  }

  console.log(`ジョブ開始: ${jobName}`);
  const startTime = Date.now();

  try {
    await jobs[jobName]();
    const duration = Date.now() - startTime;
    console.log(`ジョブ ${jobName} が正常に完了しました（${duration}ms）`);
  } catch (error) {
    console.error(`ジョブ ${jobName} が失敗しました:`, error);
    process.exit(1);
  } finally {
    // リソースのクリーンアップ
    await cleanup();
  }

  process.exit(0);
}

main();
