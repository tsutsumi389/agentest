# 課金・サブスクリプション機能 未実装項目の実装計画

## 設計方針

**Stripeをマスターとして扱い、DBは最小限のキャッシュに留める**

- Subscription/Invoiceの詳細情報はStripe APIから都度取得
- DBには表示・検索用の基本情報のみ保持
- Webhook冪等性確保のためPaymentEventのみ新規追加

---

## 未実装項目一覧

### 1. データモデル（packages/db/prisma/schema.prisma）

#### 追加が必要なモデル

| モデル | 目的 | 必要性 |
|--------|------|--------|
| **PaymentEvent** | Webhook冪等性確保・監査ログ | 必須 |

### 2. API（apps/api/src/）

| エンドポイント | 用途 | 実装方法 |
|---------------|------|---------|
| GET /api/users/:userId/invoices | 請求履歴一覧 | Stripe API + Redisキャッシュ |
| GET /api/users/:userId/invoices/:id | 請求書詳細 | Stripe API経由で取得 |
| GET /api/users/:userId/invoices/:id/pdf | PDFダウンロード | Stripe PDFリンクにリダイレクト |
| GET /api/users/me/plan | 現在のプラン情報 | DB + Stripe併用 |
| PUT /api/users/:userId/subscription | プラン変更 | Stripe Subscription更新 |

### 3. フロントエンド（apps/web/src/）

| コンポーネント | 用途 |
|---------------|------|
| `InvoiceList.tsx` | 個人向け請求履歴表示 |

### 4. バッチ処理（apps/api/src/jobs/）

| バッチ | 目的 | 優先度 |
|--------|------|--------|
| **HistoryCleanup** | FREEプランの30日経過履歴削除 | 高 |
| **HistoryExpiryNotify** | 削除7日前のFREEユーザーへ通知 | 中 |
| **WebhookRetry** | 処理失敗Webhookの再処理 | 中 |
| **PaymentEventCleanup** | 90日以上前の処理済みイベント削除 | 低 |

---

## セキュリティ要件

### Webhook署名検証（必須）

```typescript
// apps/api/src/controllers/webhook.controller.ts
async handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send('Webhook signature verification failed');
  }

  // PaymentEventで冪等性チェック
  const existing = await paymentEventRepo.findByExternalId(event.id);
  if (existing) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // イベント処理...
}
```

### 請求履歴APIの認可チェック（必須）

```typescript
// apps/api/src/controllers/user-invoice.controller.ts
async getInvoices(req: AuthenticatedRequest, res: Response) {
  const { userId } = req.params;

  // 自分自身のデータのみアクセス可能
  if (req.user.id !== userId) {
    throw new ForbiddenError('他のユーザーの請求履歴にはアクセスできません');
  }

  const invoices = await userInvoiceService.getInvoices(userId);
  res.json(invoices);
}
```

---

## Stripe APIキャッシュ戦略

### Redisによる短期キャッシュ（5分）

```typescript
// apps/api/src/services/user-invoice.service.ts
async getInvoices(userId: string): Promise<Invoice[]> {
  const cacheKey = `invoices:user:${userId}`;

  // キャッシュチェック
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Stripe APIから取得
  const subscription = await subscriptionRepo.findByUserId(userId);
  if (!subscription?.externalId) return [];

  const stripeInvoices = await stripe.invoices.list({
    subscription: subscription.externalId,
    limit: 100,
  });

  const invoices = stripeInvoices.data.map(transformToInvoice);

  // キャッシュ保存（5分）
  await redis.setex(cacheKey, 300, JSON.stringify(invoices));

  return invoices;
}
```

### キャッシュ無効化タイミング

- `invoice.paid` Webhook受信時
- `invoice.payment_failed` Webhook受信時
- 支払い方法変更時

---

## Webhookイベント処理

### 処理すべきイベント一覧

| イベント | 処理内容 | 実装状況 |
|----------|---------|---------|
| `customer.subscription.created` | サブスク作成の反映 | 要確認 |
| `customer.subscription.updated` | プラン変更・ステータス変更の反映 | 要確認 |
| `customer.subscription.deleted` | サブスク解約の反映、プランをFREEに | 要確認 |
| `invoice.paid` | 支払い成功の記録、キャッシュ無効化 | 要確認 |
| `invoice.payment_failed` | 支払い失敗通知、ユーザーへメール送信 | 要確認 |

### Webhook処理フロー

```typescript
// apps/api/src/services/webhook.service.ts
async processEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.updated':
      await this.handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await this.handleSubscriptionDeleted(event.data.object);
      break;
    case 'invoice.paid':
      await this.handleInvoicePaid(event.data.object);
      // キャッシュ無効化
      await this.invalidateInvoiceCache(event.data.object);
      break;
    case 'invoice.payment_failed':
      await this.handlePaymentFailed(event.data.object);
      break;
  }
}
```

---

## 実装計画

### Phase A: PaymentEventモデル追加

**対象ファイル**: `packages/db/prisma/schema.prisma`

```prisma
enum PaymentEventStatus {
  PENDING
  PROCESSED
  FAILED
}

model PaymentEvent {
  id           String             @id @default(uuid())
  externalId   String             @unique @map("external_id") @db.VarChar(255)
  eventType    String             @map("event_type") @db.VarChar(100)
  payload      Json
  status       PaymentEventStatus @default(PENDING)
  processedAt  DateTime?          @map("processed_at")
  errorMessage String?            @map("error_message") @db.Text
  retryCount   Int                @default(0) @map("retry_count")
  createdAt    DateTime           @default(now()) @map("created_at")
  updatedAt    DateTime           @updatedAt @map("updated_at")

  @@index([status])
  @@index([eventType])
  @@index([createdAt])  // 古いイベント削除用
  @@map("payment_events")
}
```

**追加ファイル**:
- `apps/api/src/repositories/payment-event.repository.ts`

---

### Phase B: Webhook処理の強化

**対象ファイル**: `apps/api/src/services/webhook.service.ts`

実装内容:
1. 署名検証の確認・強化
2. PaymentEvent統合による冪等性確保
3. 全必要イベントのハンドラー実装
4. キャッシュ無効化処理

---

### Phase C: 個人向け請求履歴API

**対象ファイル**:
- `apps/api/src/controllers/user-invoice.controller.ts` (新規)
- `apps/api/src/services/user-invoice.service.ts` (新規)
- `apps/api/src/routes/users.ts` (追加)

実装内容:
1. 認可チェック（自分自身のデータのみ）
2. Stripe API経由での請求書取得
3. Redisキャッシュ（5分）

---

### Phase D: フロントエンド

**対象ファイル**:
- `apps/web/src/components/billing/InvoiceList.tsx` (新規)
- `apps/web/src/components/settings/BillingSettings.tsx` (追加)
- `apps/web/src/lib/api/billing.ts` (追加)

---

### Phase E: バッチ処理

#### E-1: HistoryCleanupジョブ（カーソルベース）

**対象ファイル**: `apps/api/src/jobs/history-cleanup.job.ts`

```typescript
export async function runHistoryCleanup() {
  let cursor: string | undefined;
  const batchSize = 100;

  do {
    // カーソルベースでFREEユーザーを取得
    const { users, nextCursor } = await getFreeUsersBatch(cursor, batchSize);

    // 並列処理（同時実行数制限付き）
    await Promise.all(
      users.map(user => deleteOldHistory(user.id, PLAN_LIMITS.FREE.changeHistoryDays))
    );

    cursor = nextCursor;
  } while (cursor);
}
```

#### E-2: PaymentEventCleanupジョブ

**対象ファイル**: `apps/api/src/jobs/payment-event-cleanup.job.ts`

```typescript
// 90日以上前のPROCESSEDイベントを削除
export async function runPaymentEventCleanup() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  await prisma.paymentEvent.deleteMany({
    where: {
      status: 'PROCESSED',
      createdAt: { lt: cutoffDate },
    },
  });
}
```

---

### Phase F: プラン制限定数

**対象ファイル**: `apps/api/src/config/plan-limits.ts` (新規)

```typescript
export const PLAN_LIMITS = {
  FREE: {
    changeHistoryDays: 30,
    executionHistoryKeepLatest: 1,
    projectLimit: 3,
  },
  PRO: {
    changeHistoryDays: null,
    executionHistoryKeepLatest: null,
    projectLimit: null,
  },
  TEAM: {
    changeHistoryDays: null,
    executionHistoryKeepLatest: null,
    projectLimit: null,
  },
  ENTERPRISE: {
    changeHistoryDays: null,
    executionHistoryKeepLatest: null,
    projectLimit: null,
  },
} as const;
```

---

## ダウングレード時のデータ処理

### 方針: 即時削除ではなく、次回バッチで削除

```typescript
// ダウングレードWebhook受信時
async handleSubscriptionDowngraded(subscription: Stripe.Subscription) {
  // DBのプランを更新
  await subscriptionRepo.update(subscription.id, { plan: 'FREE' });

  // 履歴は即時削除しない
  // → 次回のHistoryCleanupバッチで30日ルールに基づき削除
  // → ユーザーにアップグレードの猶予を与える

  // 通知を送信
  await notificationService.sendDowngradeNotice(userId, {
    message: 'プランがFREEに変更されました。30日以上前の履歴は次回以降削除されます。',
  });
}
```

---

## 追加検討事項

### 1. サブスク状態の同期遅延対策

Webhookが失敗した場合のDB-Stripe間の状態乖離を検知・修復:

```typescript
// 定期的な同期チェックジョブ（週1回程度）
export async function runSubscriptionSyncCheck() {
  const subscriptions = await subscriptionRepo.findAllActive();

  for (const sub of subscriptions) {
    if (!sub.externalId) continue;

    const stripeSub = await stripe.subscriptions.retrieve(sub.externalId);

    // 状態の乖離をチェック
    if (sub.status !== mapStripeStatus(stripeSub.status)) {
      console.warn(`Subscription sync mismatch: ${sub.id}`);
      // 修復または通知
    }
  }
}
```

### 2. テスト環境の分離

```bash
# 環境変数で分離
# .env.development
STRIPE_WEBHOOK_SECRET=whsec_test_xxx

# .env.production
STRIPE_WEBHOOK_SECRET=whsec_live_xxx
```

### 3. Stripe Customer Portal検討

将来的にStripe Customer Portalを使えば、以下を自前実装不要:
- 請求履歴表示
- 支払い方法変更
- サブスクリプションキャンセル

現時点では自前実装を進め、運用負荷が高まった場合にPortal移行を検討。

---

## 重要ファイル

| ファイル | 変更内容 |
|----------|----------|
| `packages/db/prisma/schema.prisma` | PaymentEventモデル追加 |
| `apps/api/src/routes/users.ts` | 請求履歴APIルート追加 |
| `apps/api/src/controllers/webhook.controller.ts` | 署名検証強化 |
| `apps/api/src/services/webhook.service.ts` | PaymentEvent統合、イベントハンドラー |
| `apps/api/src/services/user-invoice.service.ts` | Stripe API + Redisキャッシュ |
| `apps/api/src/config/plan-limits.ts` | プラン制限定数（新規） |
| `apps/api/src/jobs/history-cleanup.job.ts` | カーソルベースの履歴削除（新規） |
| `apps/api/src/jobs/payment-event-cleanup.job.ts` | 古いイベント削除（新規） |
| `apps/web/src/components/billing/InvoiceList.tsx` | 請求履歴UI（新規） |

---

## 検証方法

1. **Webhook署名検証**: 不正な署名でリクエストを送信し、400エラーを確認
2. **PaymentEvent冪等性**: 同じWebhookを2回送信し、2回目が無視されることを確認
3. **認可チェック**: 他ユーザーのuserIdで請求履歴APIを呼び、403エラーを確認
4. **キャッシュ**: 請求履歴取得後、5分以内の再取得でStripe APIが呼ばれないことを確認
5. **履歴削除バッチ**: FREEプランユーザーの31日前の履歴が削除されることを確認
6. **ダウングレード**: PRO→FREE変更後、履歴が即時削除されず猶予があることを確認

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
