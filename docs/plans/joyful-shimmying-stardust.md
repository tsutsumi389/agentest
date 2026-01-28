# 課金・サブスクリプション機能 未実装項目の実装計画

## 設計方針

**Stripeをマスターとして扱い、DBは最小限のキャッシュに留める**

- Subscription/Invoiceの詳細情報はStripe APIから都度取得
- DBには表示・検索用の基本情報のみ保持
- Webhook冪等性確保のためPaymentEventのみ新規追加

---

## 未実装項目一覧（修正版）

### 1. データモデル（packages/db/prisma/schema.prisma）

#### 追加が必要なモデル

| モデル | 目的 | 必要性 |
|--------|------|--------|
| **PaymentEvent** | Webhook冪等性確保・監査ログ | 必須 |

#### 追加不要（Stripe APIで取得）

| 項目 | Stripe側で管理 |
|------|---------------|
| Subscription拡張（scheduledPlan等） | Subscription Schedules API |
| Invoice拡張（subtotal, tax等） | Invoice API |
| PlanPricing | Price API |

#### HistoryRetentionPolicy

履歴保持ポリシーは**コード内定数**で管理（シンプルに保つ）:

```typescript
// apps/api/src/config/plan-limits.ts
export const PLAN_LIMITS = {
  FREE: {
    changeHistoryDays: 30,
    executionHistoryKeepLatest: 1,
    projectLimit: 3,
  },
  PRO: {
    changeHistoryDays: null, // 無制限
    executionHistoryKeepLatest: null,
    projectLimit: null,
  },
  // ...
};
```

---

### 2. API（apps/api/src/）

#### 2.1 個人向けAPI - 未実装

| エンドポイント | 用途 | 実装方法 |
|---------------|------|---------|
| GET /api/users/:userId/invoices | 請求履歴一覧 | Stripe API経由で取得 |
| GET /api/users/:userId/invoices/:id | 請求書詳細 | Stripe API経由で取得 |
| GET /api/users/:userId/invoices/:id/pdf | PDFダウンロード | Stripe PDFリンクにリダイレクト |
| GET /api/users/me/plan | 現在のプラン情報 | DB + Stripe併用 |
| PUT /api/users/:userId/subscription | プラン変更 | Stripe Subscription更新 |

#### 2.2 実装済みAPI（変更不要）

- 個人向けサブスクリプション: GET/POST/DELETE/reactivate ✓
- 個人向け支払い方法: GET/POST/DELETE/default ✓
- 組織向け: 全て ✓

---

### 3. フロントエンド（apps/web/src/）

#### 未実装

| コンポーネント | 用途 |
|---------------|------|
| `InvoiceList.tsx` | 個人向け請求履歴表示 |

---

### 4. バッチ処理（apps/api/src/jobs/）

#### 必要なバッチ

| バッチ | 目的 | 優先度 |
|--------|------|--------|
| **HistoryCleanup** | FREEプランの30日経過履歴削除 | 高 |
| **HistoryExpiryNotify** | 削除7日前のFREEユーザーへ通知 | 中 |
| **WebhookRetry** | 処理失敗Webhookの再処理 | 中 |

#### Stripe側で自動処理（実装不要）

| 処理 | Stripe側の機能 |
|------|---------------|
| SubscriptionRenewal | Stripeが自動更新・Webhook通知 |
| PaymentRetry | Stripeの自動リトライ（Smart Retries） |
| DowngradeApply | Subscription Schedulesで自動適用 |

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
  @@map("payment_events")
}
```

**追加ファイル**:
- `apps/api/src/repositories/payment-event.repository.ts`
- `apps/api/src/services/webhook.service.ts`（既存を修正）

---

### Phase B: 個人向け請求履歴API

**対象ファイル**:
- `apps/api/src/controllers/user-invoice.controller.ts` (新規)
- `apps/api/src/services/user-invoice.service.ts` (新規)
- `apps/api/src/routes/users.ts` (追加)

**実装内容**:
```typescript
// Stripe APIから請求履歴を取得
async getInvoices(userId: string): Promise<Invoice[]> {
  const subscription = await this.subscriptionRepo.findByUserId(userId);
  if (!subscription?.externalId) return [];

  // Stripe APIで請求書一覧取得
  const stripeInvoices = await stripe.invoices.list({
    subscription: subscription.externalId,
  });

  return stripeInvoices.data.map(transformToInvoice);
}
```

---

### Phase C: フロントエンド

**対象ファイル**:
- `apps/web/src/components/billing/InvoiceList.tsx` (新規)
- `apps/web/src/components/settings/BillingSettings.tsx` (追加)
- `apps/web/src/lib/api/billing.ts` (追加)

---

### Phase D: バッチ処理

#### D-1: HistoryCleanupジョブ

**対象ファイル**: `apps/api/src/jobs/history-cleanup.job.ts`

```typescript
export function startHistoryCleanupJob(intervalMs = 24 * 60 * 60 * 1000) {
  const cleanup = async () => {
    // FREEプランユーザーの30日以上前の履歴を削除
    const freeUsers = await getUsersWithPlan('FREE');
    for (const user of freeUsers) {
      await deleteOldHistory(user.id, 30);
    }
  };

  return setInterval(cleanup, intervalMs);
}
```

#### D-2: HistoryExpiryNotifyジョブ

**対象ファイル**: `apps/api/src/jobs/history-expiry-notify.job.ts`

#### D-3: WebhookRetryジョブ

**対象ファイル**: `apps/api/src/jobs/webhook-retry.job.ts`

---

### Phase E: プラン制限定数

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

## 重要ファイル

| ファイル | 変更内容 |
|----------|----------|
| `packages/db/prisma/schema.prisma` | PaymentEventモデル追加 |
| `apps/api/src/routes/users.ts` | 請求履歴APIルート追加 |
| `apps/api/src/services/webhook.service.ts` | PaymentEvent統合で冪等性確保 |
| `apps/api/src/config/plan-limits.ts` | プラン制限定数（新規） |
| `apps/api/src/jobs/history-cleanup.job.ts` | 履歴削除バッチ（新規） |
| `apps/web/src/components/billing/InvoiceList.tsx` | 請求履歴UI（新規） |

---

## 検証方法

1. **PaymentEvent**: 同じWebhookを2回送信し、2回目が無視されることを確認
2. **請求履歴API**: Stripe Test Modeで請求書作成後、API経由で取得確認
3. **履歴削除バッチ**: FREEプランユーザーの31日前の履歴が削除されることを確認
4. **フロントエンド**: `/settings?tab=billing` で請求履歴が表示されることを確認

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
