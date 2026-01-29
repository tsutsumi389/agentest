# 課金・サブスクリプション機能 未実装項目の実装計画

## 実装状況

| Phase | 内容 | 状況 |
|-------|------|------|
| Phase A | PaymentEventモデル追加 | ✅ 完了 |
| Phase B | Webhook処理の強化 | ✅ 完了 |
| Phase C | 個人向け請求履歴API | ✅ 完了 |
| Phase D | フロントエンド（InvoiceList） | ✅ 完了 |
| Phase E | バッチ処理（Cloud Run Jobs） | ✅ 完了 |
| Phase F | プラン制限定数 | ✅ 完了 |

### 実装済みファイル一覧

#### Phase A: データモデル
- `packages/db/prisma/schema.prisma` - PaymentEventモデル追加済み

#### Phase B: Webhook処理
- `apps/api/src/services/webhook.service.ts` - 冪等性チェック、イベントハンドラー実装済み
- `apps/api/src/controllers/webhook.controller.ts` - 署名検証実装済み
- `apps/api/src/repositories/payment-event.repository.ts` - PaymentEvent操作

#### Phase C: 個人向け請求履歴API
- `apps/api/src/controllers/user-invoice.controller.ts` - コントローラー
- `apps/api/src/services/user-invoice.service.ts` - サービス（Redisキャッシュ含む）
- `apps/api/src/routes/users.ts` - ルート定義（請求履歴エンドポイント追加）

#### Phase D: フロントエンド
- `apps/web/src/components/billing/InvoiceList.tsx` - 請求履歴一覧UI

#### Phase E: バッチ処理（Cloud Run Jobs）
- `apps/jobs/package.json` - パッケージ定義
- `apps/jobs/tsconfig.json` - TypeScript設定
- `apps/jobs/Dockerfile` - Cloud Run Jobs用Dockerfile
- `apps/jobs/src/index.ts` - エントリーポイント（ジョブ振り分け）
- `apps/jobs/src/lib/prisma.ts` - Prismaクライアント
- `apps/jobs/src/lib/redis.ts` - Redisクライアント
- `apps/jobs/src/lib/stripe.ts` - Stripeクライアント
- `apps/jobs/src/lib/email.ts` - メール送信ユーティリティ
- `apps/jobs/src/jobs/history-cleanup.ts` - FREEプランの30日経過履歴削除
- `apps/jobs/src/jobs/history-expiry-notify.ts` - 削除7日前のFREEユーザーへ通知
- `apps/jobs/src/jobs/webhook-retry.ts` - 処理失敗Webhookの再処理
- `apps/jobs/src/jobs/payment-event-cleanup.ts` - 90日以上前の処理済みイベント削除
- `apps/jobs/src/jobs/subscription-sync.ts` - DB-Stripe間の状態同期チェック

#### Phase F: プラン制限定数
- `packages/shared/src/config/plan-pricing.ts` - プラン料金・制限定義

---

## 設計方針

**Stripeをマスターとして扱い、DBは最小限のキャッシュに留める**

- Subscription/Invoiceの詳細情報はStripe APIから都度取得
- DBには表示・検索用の基本情報のみ保持
- Webhook冪等性確保のためPaymentEventのみ新規追加

---

## 未実装項目一覧（残り）

なし - すべて実装完了

### ~~1. バッチ処理（apps/jobs/ - Cloud Run Jobs）~~（✅ 実装完了）

| ジョブ | 目的 | スケジュール |
|--------|------|-------------|
| **history-cleanup** | FREEプランの30日経過履歴削除 | 毎日 3:00 JST |
| **history-expiry-notify** | 削除7日前のFREEユーザーへ通知 | 毎日 9:00 JST |
| **webhook-retry** | 処理失敗Webhookの再処理 | 毎時 0分 |
| **payment-event-cleanup** | 90日以上前の処理済みイベント削除 | 毎週日曜 4:00 JST |
| **subscription-sync** | DB-Stripe間の状態同期チェック | 毎週日曜 5:00 JST |

---

## 残り実装計画

### Phase E: バッチ処理（Cloud Run Jobs）（未実装）

#### ディレクトリ構成

```
apps/jobs/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts              # エントリーポイント（ジョブ振り分け）
│   ├── jobs/
│   │   ├── history-cleanup.ts
│   │   ├── history-expiry-notify.ts
│   │   ├── webhook-retry.ts
│   │   ├── payment-event-cleanup.ts
│   │   └── subscription-sync.ts
│   └── lib/
│       ├── prisma.ts
│       ├── redis.ts
│       └── stripe.ts
```

#### E-1: エントリーポイント

**対象ファイル**: `apps/jobs/src/index.ts`

```typescript
import { runHistoryCleanup } from './jobs/history-cleanup.js';
import { runHistoryExpiryNotify } from './jobs/history-expiry-notify.js';
import { runWebhookRetry } from './jobs/webhook-retry.js';
import { runPaymentEventCleanup } from './jobs/payment-event-cleanup.js';
import { runSubscriptionSync } from './jobs/subscription-sync.js';

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
    console.error(`Unknown job: ${jobName}`);
    console.error(`Available jobs: ${Object.keys(jobs).join(', ')}`);
    process.exit(1);
  }

  console.log(`Starting job: ${jobName}`);
  const startTime = Date.now();

  try {
    await jobs[jobName]();
    const duration = Date.now() - startTime;
    console.log(`Job ${jobName} completed successfully in ${duration}ms`);
    process.exit(0);
  } catch (error) {
    console.error(`Job ${jobName} failed:`, error);
    process.exit(1);
  }
}

main();
```

#### E-2: Dockerfile

**対象ファイル**: `apps/jobs/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# pnpmインストール
RUN corepack enable && corepack prepare pnpm@latest --activate

# 依存関係のコピーとインストール
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/jobs/package.json apps/jobs/

RUN pnpm install --frozen-lockfile

# ソースコードのコピー
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY apps/jobs apps/jobs

# ビルド
RUN pnpm --filter @agentest/db build
RUN pnpm --filter @agentest/shared build
RUN pnpm --filter @agentest/jobs build

# 本番イメージ
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/jobs ./apps/jobs

WORKDIR /app/apps/jobs

CMD ["node", "dist/index.js"]
```

#### E-3: HistoryCleanupジョブ（カーソルベース）

**対象ファイル**: `apps/jobs/src/jobs/history-cleanup.ts`

```typescript
import { prisma } from '../lib/prisma.js';
import { PLAN_LIMITS } from '@agentest/shared';

export async function runHistoryCleanup() {
  const batchSize = 100;
  let cursor: string | undefined;
  let totalDeleted = 0;

  do {
    // カーソルベースでFREEユーザーを取得
    const users = await prisma.user.findMany({
      where: {
        subscription: { plan: 'FREE' },
      },
      take: batchSize,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (users.length === 0) break;

    // 各ユーザーの古い履歴を削除
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - PLAN_LIMITS.FREE.changeHistoryDays);

    for (const user of users) {
      const result = await prisma.testCaseHistory.deleteMany({
        where: {
          testCase: { project: { userId: user.id } },
          createdAt: { lt: cutoffDate },
        },
      });
      totalDeleted += result.count;
    }

    cursor = users[users.length - 1]?.id;
  } while (cursor);

  console.log(`Deleted ${totalDeleted} old history records`);
}
```

#### E-4: Cloud Scheduler設定

```yaml
# cloud-scheduler.yaml（Terraformまたは手動設定用のリファレンス）
jobs:
  - name: history-cleanup
    schedule: "0 3 * * *"  # 毎日 3:00 JST
    timeZone: "Asia/Tokyo"
    cloudRunJob:
      name: agentest-jobs
      env:
        - name: JOB_NAME
          value: history-cleanup

  - name: history-expiry-notify
    schedule: "0 9 * * *"  # 毎日 9:00 JST
    timeZone: "Asia/Tokyo"
    cloudRunJob:
      name: agentest-jobs
      env:
        - name: JOB_NAME
          value: history-expiry-notify

  - name: webhook-retry
    schedule: "0 * * * *"  # 毎時 0分
    timeZone: "Asia/Tokyo"
    cloudRunJob:
      name: agentest-jobs
      env:
        - name: JOB_NAME
          value: webhook-retry

  - name: payment-event-cleanup
    schedule: "0 4 * * 0"  # 毎週日曜 4:00 JST
    timeZone: "Asia/Tokyo"
    cloudRunJob:
      name: agentest-jobs
      env:
        - name: JOB_NAME
          value: payment-event-cleanup

  - name: subscription-sync
    schedule: "0 5 * * 0"  # 毎週日曜 5:00 JST
    timeZone: "Asia/Tokyo"
    cloudRunJob:
      name: agentest-jobs
      env:
        - name: JOB_NAME
          value: subscription-sync
```

---

## 追加検討事項

### 1. テスト環境の分離

```bash
# 環境変数で分離
# .env.development
STRIPE_WEBHOOK_SECRET=whsec_test_xxx

# .env.production
STRIPE_WEBHOOK_SECRET=whsec_live_xxx
```

### 2. Stripe Customer Portal検討

将来的にStripe Customer Portalを使えば、以下を自前実装不要:
- 請求履歴表示
- 支払い方法変更
- サブスクリプションキャンセル

現時点では自前実装を進め、運用負荷が高まった場合にPortal移行を検討。

---

## 実装済みファイル

| ファイル | 変更内容 | 状況 |
|----------|----------|------|
| `packages/db/prisma/schema.prisma` | PaymentEventモデル追加 | ✅ 完了 |
| `packages/shared/src/config/plan-pricing.ts` | プラン料金・制限定義 | ✅ 完了 |
| `apps/api/src/routes/users.ts` | 請求履歴APIルート追加 | ✅ 完了 |
| `apps/api/src/controllers/webhook.controller.ts` | 署名検証強化 | ✅ 完了 |
| `apps/api/src/services/webhook.service.ts` | PaymentEvent統合、イベントハンドラー | ✅ 完了 |
| `apps/api/src/services/user-invoice.service.ts` | Stripe API + Redisキャッシュ | ✅ 完了 |
| `apps/api/src/controllers/user-invoice.controller.ts` | 請求履歴コントローラー | ✅ 完了 |
| `apps/api/src/repositories/payment-event.repository.ts` | PaymentEvent操作 | ✅ 完了 |
| `apps/web/src/components/billing/InvoiceList.tsx` | 請求履歴UI | ✅ 完了 |
| `apps/jobs/` | Cloud Run Jobs用バッチ処理（新規ディレクトリ） | ✅ 完了 |

---

## 検証方法

### 実装済み機能（Phase A〜D, F）

1. **Webhook署名検証**: 不正な署名でリクエストを送信し、400エラーを確認 ✅
2. **PaymentEvent冪等性**: 同じWebhookを2回送信し、2回目が無視されることを確認 ✅
3. **認可チェック**: 他ユーザーのuserIdで請求履歴APIを呼び、403エラーを確認 ✅
4. **キャッシュ**: 請求履歴取得後、5分以内の再取得でStripe APIが呼ばれないことを確認 ✅

### 未実装機能（Phase E: バッチ処理）

5. **Cloud Run Jobs**: ローカルで `JOB_NAME=history-cleanup node dist/index.js` を実行し動作確認
6. **履歴削除バッチ**: FREEプランユーザーの31日前の履歴が削除されることを確認
7. **ダウングレード**: PRO→FREE変更後、履歴が即時削除されず猶予があることを確認

---

## 実装から除外した項目

| 項目 | 理由 |
|------|------|
| Subscription拡張フィールド | Stripe APIで取得可能 |
| Invoice拡張フィールド | Stripe APIで取得可能 |
| PlanPricingモデル | Stripe Price APIで代替 |
| HistoryRetentionPolicyモデル | コード内定数で十分 |
| SubscriptionRenewalバッチ | Stripeが自動処理 |
| PaymentRetryバッチ | Stripe Smart Retriesで自動処理 |
| DowngradeApplyバッチ | Subscription Schedulesで自動処理 |
