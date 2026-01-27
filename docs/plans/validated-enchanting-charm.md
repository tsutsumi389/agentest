# Stripe実装計画: モックからStripeへの切り替え

## 概要

既存のゲートウェイパターン（`IPaymentGateway` → `MockGateway` / `StripeGateway`）を活用し、スケルトン状態の`StripeGateway`を完全実装する。フロントエンドはStripe Elementsでカード収集、バックエンドはWebhook処理を含む。

---

## Phase 1: 依存パッケージ・環境変数

### 1.1 パッケージ追加
```bash
docker compose exec dev pnpm --filter @agentest/api add stripe
docker compose exec dev pnpm --filter @agentest/web add @stripe/stripe-js @stripe/react-stripe-js
```

### 1.2 環境変数追加
**`.env.example`** に以下を追加:
```
# Payment (Stripe)
PAYMENT_GATEWAY=mock
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
VITE_PAYMENT_GATEWAY=mock
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### 1.3 環境変数スキーマ更新
- **`apps/api/src/config/env.ts`**: `PAYMENT_GATEWAY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY` を追加

---

## Phase 2: StripeGateway 完全実装

**対象ファイル**: `apps/api/src/gateways/payment/stripe.gateway.ts`

スケルトンの全メソッドをStripe SDKで実装する:

| カテゴリ | メソッド | Stripe API |
|---------|---------|-----------|
| 顧客 | `createCustomer` | `stripe.customers.create()` |
| 顧客 | `getCustomer` | `stripe.customers.retrieve()` |
| 支払い | `attachPaymentMethod` | `stripe.paymentMethods.attach()` |
| 支払い | `detachPaymentMethod` | `stripe.paymentMethods.detach()` |
| 支払い | `listPaymentMethods` | `stripe.paymentMethods.list()` |
| 支払い | `setDefaultPaymentMethod` | `stripe.customers.update()` (invoice_settings) |
| 定期購読 | `createSubscription` | `stripe.subscriptions.create()` |
| 定期購読 | `updateSubscription` | `stripe.subscriptions.update()` |
| 定期購読 | `cancelSubscription` | `stripe.subscriptions.update/cancel()` |
| 定期購読 | `reactivateSubscription` | `stripe.subscriptions.update()` |
| 定期購読 | `getSubscription` | `stripe.subscriptions.retrieve()` |
| 日割り | `previewProration` | `stripe.invoices.createPreview()` |
| 請求書 | `getInvoice` / `listInvoices` / `getInvoicePdf` | `stripe.invoices.*` |
| Webhook | `verifyWebhookSignature` | `stripe.webhooks.constructEvent()` |
| Webhook | `parseWebhookEvent` | JSON parse + 型変換 |

**設計ポイント**:
- Price IDは環境変数 `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_YEARLY` から解決
- サブスクリプション作成時に `metadata: { plan, billingCycle }` を保存し、取得時に復元
- JPYはゼロデシマル通貨（980 = ¥980）。変換不要

---

## Phase 3: SetupIntentエンドポイント（Stripe Elements用）

Stripe Elementsはカード情報収集に`SetupIntent`の`client_secret`が必要。

### 3.1 インターフェース拡張
**`apps/api/src/gateways/payment/payment-gateway.interface.ts`**: `createSetupIntent(customerId)` メソッド追加

### 3.2 各ゲートウェイに実装
- **MockGateway**: ダミーの `client_secret` を返す
- **StripeGateway**: `stripe.setupIntents.create()` を呼び出す

### 3.3 サービス・コントローラー・ルート追加
- **`apps/api/src/services/payment-method.service.ts`**: `createSetupIntent(userId)` メソッド追加
- **`apps/api/src/controllers/payment-method.controller.ts`**: ハンドラー追加
- **`apps/api/src/routes/users.ts`**: `POST /:userId/payment-methods/setup-intent` 追加

---

## Phase 4: Webhookエンドポイント

### 4.1 raw bodyパーサー設定
**`apps/api/src/app.ts`**: Webhookルートを`express.json()`の前に、`express.raw({ type: 'application/json' })`で登録

```typescript
// Webhook用（express.json()より前に登録）
import webhookRoutes from './routes/webhook.js';
app.use('/webhook', express.raw({ type: 'application/json' }), webhookRoutes);

// 既存のJSONパーサー
app.use(express.json({ limit: '50mb' }));
```

### 4.2 新規ファイル作成
- **`apps/api/src/routes/webhook.ts`**: `POST /webhook/stripe`
- **`apps/api/src/controllers/webhook.controller.ts`**: 署名検証 + サービス呼び出し
- **`apps/api/src/services/webhook.service.ts`**: イベントハンドリング

### 4.3 処理するWebhookイベント
| イベント | 処理内容 |
|---------|---------|
| `invoice.paid` | サブスクリプションステータスをACTIVEに更新、期間延長 |
| `invoice.payment_failed` | ステータスをPAST_DUEに更新 |
| `customer.subscription.updated` | 期間・cancelAtPeriodEndをDB同期 |
| `customer.subscription.deleted` | ステータスをCANCELEDに、プランをFREEに戻す |

---

## Phase 5: フロントエンド Stripe Elements

### 5.1 Stripe初期化ユーティリティ
**新規: `apps/web/src/lib/stripe.ts`**: `loadStripe(VITE_STRIPE_PUBLISHABLE_KEY)` のシングルトン

### 5.2 API追加
**`apps/web/src/lib/api.ts`**: `paymentMethodsApi.createSetupIntent(userId)` 追加

### 5.3 AddPaymentMethodModal書き換え
**`apps/web/src/components/billing/AddPaymentMethodModal.tsx`**:
- スタブの `StripeCardForm` を実装
- `Elements` プロバイダーで `PaymentElement` をラップ
- フロー: SetupIntent取得 → カード入力 → `stripe.confirmSetup()` → PaymentMethod ID をバックエンドに送信

### 5.4 CSP更新
**`apps/api/src/app.ts`**: helmetのCSPに `js.stripe.com` を追加（script-src, frame-src, connect-src）

---

## Phase 6: Docker Compose環境変数

**`docker/docker-compose.yml`** および **`docker/docker-compose.override.yml`**: Stripe関連の環境変数をサービスに追加

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/gateways/payment/stripe.gateway.ts` | 全メソッド実装 |
| `apps/api/src/gateways/payment/payment-gateway.interface.ts` | `createSetupIntent` 追加 |
| `apps/api/src/gateways/payment/mock.gateway.ts` | `createSetupIntent` 追加 |
| `apps/api/src/services/payment-method.service.ts` | `createSetupIntent` メソッド追加 |
| `apps/api/src/controllers/payment-method.controller.ts` | ハンドラー追加 |
| `apps/api/src/routes/users.ts` | SetupIntentルート追加 |
| `apps/api/src/app.ts` | Webhookルート登録 + CSP更新 |
| `apps/api/src/routes/webhook.ts` | **新規**: Webhookルート |
| `apps/api/src/controllers/webhook.controller.ts` | **新規**: Webhookコントローラー |
| `apps/api/src/services/webhook.service.ts` | **新規**: Webhookサービス |
| `apps/api/src/config/env.ts` | Stripe環境変数追加 |
| `apps/web/src/lib/stripe.ts` | **新規**: Stripe初期化 |
| `apps/web/src/lib/api.ts` | SetupIntent API追加 |
| `apps/web/src/components/billing/AddPaymentMethodModal.tsx` | Stripe Elements実装 |
| `.env.example` | Stripe環境変数追加 |
| `docker/docker-compose.yml` | 環境変数追加 |

---

## テスト方針

- 既存テストは`MockGateway`を使用しており、変更なしで動作する
- Webhookテストは `stripe listen --forward-to localhost:3001/webhook/stripe` で確認
- フロントエンドはStripeのテストモード（`pk_test_*`）で動作確認
- `PAYMENT_GATEWAY=mock`（デフォルト）のままなら既存動作に影響なし
