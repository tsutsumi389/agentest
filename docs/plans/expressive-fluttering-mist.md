# Phase 4: Webhookエンドポイント実装

## 概要

Stripeからのwebhookイベントを受信・処理するエンドポイントを実装する。
ゲートウェイ層の`verifyAndParseWebhookEvent`は実装済みのため、ルート・サービス・コントローラーの追加が主な作業。

## 重要な技術的考慮事項

Stripeのwebhook署名検証には**生のリクエストボディ（文字列）**が必要。`express.json()`でパースされた後のbodyは使えないため、webhookルートだけ`express.raw()`でボディを受け取る必要がある。

## 実装ファイル一覧

### 1. `apps/api/src/app.ts` - raw body対応

- webhookパス (`/webhooks/stripe`) に対して `express.raw({ type: 'application/json' })` を適用
- 既存の `express.json()` より**前**に配置

### 2. `apps/api/src/services/webhook.service.ts` - 新規作成

イベントハンドラのビジネスロジック:

```
WebhookService
├── handleEvent(event: WebhookEvent): Promise<void>  // ディスパッチャ
├── handleInvoicePaid(data): Promise<void>            // 請求書支払い完了
├── handleInvoicePaymentFailed(data): Promise<void>   // 支払い失敗
├── handleSubscriptionCreated(data): Promise<void>    // サブスクリプション作成
├── handleSubscriptionUpdated(data): Promise<void>    // サブスクリプション更新
└── handleSubscriptionDeleted(data): Promise<void>    // サブスクリプション削除
```

各ハンドラの処理内容:

- **invoice.paid**: Invoiceレコードを作成/更新（status=PAID）
- **invoice.payment_failed**: Invoiceレコードを作成/更新（status=FAILED）、サブスクリプションのstatusをPAST_DUEに更新
- **customer.subscription.created**: DBのSubscriptionレコードを同期（通常はcreateSubscription時にDB書き込み済みのため、未登録時のみ作成）
- **customer.subscription.updated**: plan, billingCycle, status, currentPeriodStart/End, cancelAtPeriodEndをDB同期
- **customer.subscription.deleted**: SubscriptionのstatusをCANCELED、User.planをFREEに更新

### 3. `apps/api/src/controllers/webhook.controller.ts` - 新規作成

```typescript
WebhookController
└── handleStripeWebhook(req, res, next): Promise<void>
    // 1. gateway.verifyAndParseWebhookEvent(rawBody, signature)
    // 2. webhookService.handleEvent(event)
    // 3. res.json({ received: true })
```

### 4. `apps/api/src/routes/webhooks.ts` - 新規作成

```
POST /webhooks/stripe  (認証不要、レート制限なし)
```

### 5. `apps/api/src/routes/index.ts` - ルート登録

```typescript
router.use('/webhooks', webhookRoutes);  // 認証不要
```

### 6. `apps/api/src/repositories/subscription.repository.ts` - メソッド追加

```typescript
findByExternalId(externalId: string): Promise<Subscription | null>
```

### 7. `apps/api/src/repositories/invoice.repository.ts` - 新規作成

```typescript
InvoiceRepository
├── findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null>
└── upsertByInvoiceNumber(invoiceNumber, data): Promise<Invoice>
```

## 処理フロー

```
Stripe → POST /webhooks/stripe
  → express.raw() でrawボディ取得
  → WebhookController.handleStripeWebhook()
    → gateway.verifyAndParseWebhookEvent(rawBody, stripe-signature)
    → webhookService.handleEvent(event)
      → イベントタイプに応じたハンドラ実行
      → DB更新
    → 200 { received: true }
```

## テスト

### ユニットテスト: `apps/api/src/__tests__/unit/webhook.service.test.ts`

- 各イベントタイプのハンドラが正しくDB更新するかテスト
- MockGatewayを使用

## 検証方法

```bash
# テスト実行
docker compose exec dev pnpm test

# 手動検証（Stripe CLI使用）
stripe listen --forward-to localhost:3000/webhooks/stripe
stripe trigger invoice.paid
```
