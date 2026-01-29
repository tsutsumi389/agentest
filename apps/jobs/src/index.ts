/**
 * バッチジョブのエントリーポイント
 * JOB_NAME環境変数で実行するジョブを振り分ける
 */
import { runHistoryCleanup } from './jobs/history-cleanup.js';
import { runHistoryExpiryNotify } from './jobs/history-expiry-notify.js';
import { runWebhookRetry } from './jobs/webhook-retry.js';
import { runPaymentEventCleanup } from './jobs/payment-event-cleanup.js';
import { runSubscriptionSync } from './jobs/subscription-sync.js';
import { closeRedis } from './lib/redis.js';

// 利用可能なジョブの定義
const jobs: Record<string, () => Promise<void>> = {
  'history-cleanup': runHistoryCleanup,
  'history-expiry-notify': runHistoryExpiryNotify,
  'webhook-retry': runWebhookRetry,
  'payment-event-cleanup': runPaymentEventCleanup,
  'subscription-sync': runSubscriptionSync,
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
    await closeRedis();
  }

  process.exit(0);
}

main();
