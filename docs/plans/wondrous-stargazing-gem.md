# Stripe実装のユニットテスト・結合テスト作成計画

## 概要

`validated-enchanting-charm.md` の実装完了に伴い、不足しているユニットテストと結合テストを作成する。

**既存テスト（変更不要）:**
- `unit/subscription.service.test.ts` - SubscriptionService
- `unit/payment-method.service.test.ts` - PaymentMethodService
- `unit/webhook.service.test.ts` - WebhookService
- `integration/billing.integration.test.ts` - 課金API結合テスト

---

## 作成するテストファイル

### ユニットテスト（5ファイル）

#### 1. `apps/api/src/__tests__/unit/stripe.gateway.test.ts`
StripeGatewayの全メソッドをStripe SDKモックでテスト。

**モック対象:** `stripe` モジュール（`Stripe` クラス）、`../../config/env.js`
**テストケース:**
- **顧客管理**
  - `createCustomer`: 正常作成、メタデータ付与
  - `getCustomer`: 正常取得、削除済み→null、404→null、他エラー→throw
- **SetupIntent**
  - `createSetupIntent`: 正常作成、client_secret欠損→エラー
- **支払い方法**
  - `attachPaymentMethod`: 正常紐付け
  - `detachPaymentMethod`: 正常解除
  - `listPaymentMethods`: 正常取得、空リスト
  - `setDefaultPaymentMethod`: 正常設定
- **サブスクリプション**
  - `createSubscription`: MONTHLY/YEARLY Price ID解決、metadata設定
  - `updateSubscription`: プラン変更、支払い方法変更、アイテムなし→エラー
  - `cancelSubscription`: 期間終了時キャンセル、即時キャンセル
  - `reactivateSubscription`: キャンセル予約解除
  - `getSubscription`: 正常取得、404→null
- **日割り計算**
  - `previewProration`: 正常計算、アイテムなし→エラー
- **請求書**
  - `getInvoice`: 正常取得、404→null
  - `listInvoices`: 正常一覧取得
  - `getInvoicePdf`: 正常取得、404→null
- **Webhook**
  - `verifyAndParseWebhookEvent`: 正常検証・パース、未対応イベントタイプ→エラー、SECRET未設定→エラー
- **ユーティリティ**
  - `resolvePriceId`: FREEプラン→エラー、MONTHLY/YEARLY正常解決、未設定→エラー
  - `toSubscriptionResult`: 各ステータスマッピング、アイテムなし→エラー

#### 2. `apps/api/src/__tests__/unit/mock.gateway.test.ts`
MockGatewayの全メソッドをテスト。

**テストケース:**
- **顧客管理**
  - 作成、取得、存在しない顧客→null
- **SetupIntent**
  - 正常作成（id、clientSecret付き）
- **支払い方法**
  - 紐付け（visa/mastercard/amexのトークン分岐）
  - 解除（デフォルト解除含む）
  - 一覧取得
  - デフォルト設定、存在しない方法→エラー
- **サブスクリプション**
  - 作成（MONTHLY/YEARLY期間計算）、請求書自動作成
  - 更新、キャンセル（即時/期間終了）、再有効化
  - 取得、存在しない→null
- **日割り計算**
  - 正常計算、存在しないサブスクリプション→エラー
- **請求書**
  - 取得、一覧（日付降順）、PDF URL
- **Webhook**
  - JSONパース（署名検証スキップ）
- **reset**
  - ストア完全リセット確認

#### 3. `apps/api/src/__tests__/unit/webhook.controller.test.ts`
WebhookControllerのHTTPリクエスト処理をテスト。

**モック対象:** `../../gateways/payment/index.js`、`../../services/webhook.service.js`、`../../utils/logger.js`
**テストケース:**
- raw body（Buffer）で正常処理→`{ received: true }`
- raw body（string）で正常処理
- JSONオブジェクト（非raw）→400エラー
- stripe-signatureヘッダー欠損→400エラー
- 署名検証失敗→nextにエラー渡し
- WebhookService.handleEvent失敗→nextにエラー渡し

#### 4. `apps/api/src/__tests__/unit/subscription.controller.test.ts`
SubscriptionControllerのリクエスト処理・バリデーションをテスト。

**モック対象:** `../../services/subscription.service.js`
**テストケース:**
- `getSubscription`: 正常取得、null返却、エラー→next
- `createSubscription`: 正常作成（201）、Zodバリデーション失敗→next（無効プラン、無効サイクル、UUID不正）、サービスエラー→next
- `cancelSubscription`: 正常キャンセル、エラー→next
- `reactivateSubscription`: 正常再有効化、エラー→next

#### 5. `apps/api/src/__tests__/unit/plans.controller.test.ts`
PlansControllerのリクエスト処理をテスト。

**モック対象:** `../../services/subscription.service.js`
**テストケース:**
- `getPlans`: プラン一覧取得（FREE/PROの価格・features含む）
- `calculatePlanChange`: 正常計算、未認証→AuthorizationError、無効プラン→Zodエラー、無効billingCycle→Zodエラー

### 結合テスト（1ファイル）

#### 6. `apps/api/src/__tests__/integration/webhook.integration.test.ts`
Webhook APIエンドポイントの結合テスト。MockGatewayを使用。

**セットアップ:** `setPaymentGateway(mockGateway)` + `createApp()`
**テストケース:**
- `POST /webhooks/stripe`
  - `invoice.paid`: サブスクリプション存在→Invoice PAID作成
  - `invoice.payment_failed`: トランザクションでInvoice作成＋ステータスPAST_DUE更新
  - `customer.subscription.updated`: DB同期（plan, billingCycle, status, period, cancelAtPeriodEnd）
  - `customer.subscription.deleted`: CANCELED更新＋ユーザープランFREEダウングレード
  - raw bodyでないリクエスト→400エラー
  - stripe-signatureヘッダー欠損→400エラー

---

## テストパターン

既存テストのパターンに準拠:
- **フレームワーク:** Vitest
- **モック:** `vi.hoisted()` + `vi.mock()` パターン
- **コメント・テスト名:** 日本語
- **コントローラーテスト:** `mockRequest()` / `mockResponse()` ヘルパー + `mockNext`
- **結合テスト:** `supertest` + `createApp()` + `setPaymentGateway()` + テストヘルパー

---

## 対象ファイルパス一覧

| 新規テストファイル | テスト対象 |
|---|---|
| `apps/api/src/__tests__/unit/stripe.gateway.test.ts` | `apps/api/src/gateways/payment/stripe.gateway.ts` |
| `apps/api/src/__tests__/unit/mock.gateway.test.ts` | `apps/api/src/gateways/payment/mock.gateway.ts` |
| `apps/api/src/__tests__/unit/webhook.controller.test.ts` | `apps/api/src/controllers/webhook.controller.ts` |
| `apps/api/src/__tests__/unit/subscription.controller.test.ts` | `apps/api/src/controllers/subscription.controller.ts` |
| `apps/api/src/__tests__/unit/plans.controller.test.ts` | `apps/api/src/controllers/plans.controller.ts` |
| `apps/api/src/__tests__/integration/webhook.integration.test.ts` | `apps/api/src/controllers/webhook.controller.ts` + `apps/api/src/services/webhook.service.ts` |

---

## 検証方法

```bash
# 全テスト実行
docker compose exec dev pnpm --filter @agentest/api test

# 個別実行（新規テストのみ）
docker compose exec dev pnpm --filter @agentest/api test -- --reporter=verbose stripe.gateway
docker compose exec dev pnpm --filter @agentest/api test -- --reporter=verbose mock.gateway
docker compose exec dev pnpm --filter @agentest/api test -- --reporter=verbose webhook.controller
docker compose exec dev pnpm --filter @agentest/api test -- --reporter=verbose subscription.controller
docker compose exec dev pnpm --filter @agentest/api test -- --reporter=verbose plans.controller
docker compose exec dev pnpm --filter @agentest/api test -- --reporter=verbose webhook.integration
```
