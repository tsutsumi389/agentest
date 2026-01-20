# USR-007: 個人プラン選択 実装計画

## 概要

個人ユーザーがFREE/PROプランを選択・変更できる機能を実装する。

### ユースケース
| シナリオ | フロー |
|----------|--------|
| FREE→PRO（支払い方法未登録） | プラン選択 → 支払い方法登録 → 請求サイクル選択 → 即時アップグレード |
| FREE→PRO（支払い方法登録済） | プラン選択 → 請求サイクル選択 → 即時アップグレード |
| PRO→FREE | プラン選択 → 警告表示 → 次回更新時にダウングレード予約 |

### ビジネスルール
- アップグレード: 即時適用（日割り請求）
- ダウングレード: 次回更新時に適用（`cancelAtPeriodEnd=true`）
- ダウングレード予約中はキャンセル可能

### 料金
- FREE: ¥0/月
- PRO: ¥980/月、¥9,800/年（2ヶ月分お得）

---

## 1. バックエンド実装

### 1.1 決済ゲートウェイインターフェース

**ファイル**: `apps/api/src/gateways/payment/payment-gateway.interface.ts`

```typescript
export interface IPaymentGateway {
  // 顧客管理
  createCustomer(email: string, metadata?: Record<string, string>): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer | null>;

  // 支払い方法管理
  attachPaymentMethod(customerId: string, token: string): Promise<PaymentMethodResult>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
  listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]>;
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  // サブスクリプション管理
  createSubscription(params: CreateSubscriptionParams): Promise<SubscriptionResult>;
  updateSubscription(subscriptionId: string, params: UpdateSubscriptionParams): Promise<SubscriptionResult>;
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<SubscriptionResult>;
  reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult>;

  // 日割り計算プレビュー（Stripe Upcoming Invoice API）
  previewProration(params: PreviewProrationParams): Promise<ProrationPreview>;
}
```

**ファイル**: `apps/api/src/gateways/payment/stripe.gateway.ts` - Stripe実装
**ファイル**: `apps/api/src/gateways/payment/mock.gateway.ts` - 開発用モック実装

### 1.2 プラン料金設定

**ファイル**: `packages/shared/src/config/plan-pricing.ts`

```typescript
export const PLAN_PRICING = {
  FREE: { monthlyPrice: 0, yearlyPrice: 0, stripePriceId: null, features: [...] },
  PRO: {
    monthlyPrice: 980,
    yearlyPrice: 9800,
    stripePriceId: { monthly: 'price_xxx', yearly: 'price_yyy' },
    features: [...]
  },
};
```

### 1.3 日割り計算（Stripeに委任）

**方針**: 日割り計算は自前で実装せず、Stripeに完全委任する。

**プレビュー表示**: Stripe Upcoming Invoice APIを使用

```typescript
// SubscriptionService内で使用
async previewPlanChange(userId: string, newPlan: 'PRO', cycle: BillingCycle) {
  const preview = await this.paymentGateway.previewProration({
    customerId: user.paymentCustomerId,
    subscriptionId: subscription.externalId,
    newPriceId: PLAN_PRICING.PRO.stripePriceId[cycle],
  });
  return {
    amountDue: preview.amountDue,       // ユーザーに表示する金額
    currency: preview.currency,
    effectiveDate: preview.effectiveDate,
  };
}
```

**実際の日割り処理**: Stripeが自動計算

```typescript
// updateSubscription内部でStripeが日割りを計算
await stripe.subscriptions.update(subscriptionId, {
  items: [{ id: itemId, price: newPriceId }],
  proration_behavior: 'create_prorations',  // Stripeが日割り請求を自動生成
});
```

**メリット**:
- 日割り計算ロジックの実装・テスト・保守が不要
- Stripeの請求書と完全に一致
- エッジケース（閏年、タイムゾーン等）はStripeが対応

### 1.4 リポジトリ層

| ファイル | 役割 |
|----------|------|
| `apps/api/src/repositories/subscription.repository.ts` | サブスクリプションCRUD |
| `apps/api/src/repositories/payment-method.repository.ts` | 支払い方法CRUD |

### 1.5 サービス層

**ファイル**: `apps/api/src/services/subscription.service.ts`

| メソッド | 処理 |
|----------|------|
| `getSubscription(userId)` | 現在のサブスクリプション取得 |
| `createSubscription(userId, plan, cycle, paymentMethodId)` | PRO新規作成（アップグレード） |
| `cancelSubscription(userId)` | ダウングレード予約（cancelAtPeriodEnd=true） |
| `reactivateSubscription(userId)` | ダウングレード予約キャンセル |
| `calculatePlanChange(userId, plan, cycle)` | 料金計算 |

**ファイル**: `apps/api/src/services/payment-method.service.ts`

| メソッド | 処理 |
|----------|------|
| `getPaymentMethods(userId)` | 支払い方法一覧 |
| `addPaymentMethod(userId, token)` | 追加（トークン経由） |
| `deletePaymentMethod(userId, id)` | 削除 |
| `setDefaultPaymentMethod(userId, id)` | デフォルト設定 |

### 1.6 コントローラー・バリデーション

**ファイル**: `apps/api/src/controllers/subscription.controller.ts`

```typescript
// Zodスキーマ
const createSubscriptionSchema = z.object({
  plan: z.literal('PRO'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  paymentMethodId: z.string().uuid(),
});
```

**ファイル**: `apps/api/src/controllers/payment-method.controller.ts`

### 1.7 ルート登録

**ファイル**: `apps/api/src/routes/users.ts` に追加

```
GET    /api/users/:userId/subscription          # 現在のサブスクリプション
POST   /api/users/:userId/subscription          # 作成（アップグレード）
DELETE /api/users/:userId/subscription          # キャンセル（ダウングレード予約）
POST   /api/users/:userId/subscription/reactivate  # ダウングレードキャンセル

GET    /api/users/:userId/payment-methods       # 支払い方法一覧
POST   /api/users/:userId/payment-methods       # 追加
DELETE /api/users/:userId/payment-methods/:id   # 削除
PUT    /api/users/:userId/payment-methods/:id/default  # デフォルト設定
```

**ファイル**: `apps/api/src/routes/billing.ts` - 新規

```
GET  /api/plans                    # プラン一覧（認証不要）
GET  /api/plans/:plan/calculate    # 料金計算（認証必要）
```

---

## 2. フロントエンド実装

### 2.1 API クライアント拡張

**ファイル**: `apps/web/src/lib/api.ts` に追加

```typescript
// 型定義
export interface Subscription { ... }
export interface PaymentMethod { ... }
export interface PlanInfo { ... }

// API関数
export const subscriptionApi = { get, create, cancel, reactivate };
export const paymentMethodsApi = { list, add, delete, setDefault };
export const plansApi = { list, calculate };
```

### 2.2 設定ページ拡張

**ファイル**: `apps/web/src/pages/Settings.tsx`

- タブに `billing` を追加: `{ id: 'billing', label: '課金', icon: CreditCard }`
- 新コンポーネント `<BillingSettings />` を追加

### 2.3 課金設定コンポーネント

**ファイル**: `apps/web/src/components/settings/BillingSettings.tsx`

構成:
1. **現在のプランカード** - プラン名、次回更新日、[プラン変更]ボタン
2. **支払い方法カード** - カード一覧、[追加][削除][デフォルト設定]
3. **プラン変更モーダル** - ステップ形式（プラン選択→支払い選択→確認）
4. **支払い方法追加モーダル** - 決済SDK連携

### 2.4 個別コンポーネント

| ファイル | 役割 |
|----------|------|
| `apps/web/src/components/billing/CurrentPlanCard.tsx` | 現在のプラン表示 |
| `apps/web/src/components/billing/PaymentMethodsCard.tsx` | 支払い方法一覧 |
| `apps/web/src/components/billing/PlanChangeModal.tsx` | プラン変更フロー |
| `apps/web/src/components/billing/AddPaymentMethodModal.tsx` | 支払い方法追加 |

---

## 3. データモデル変更

### 3.1 既存スキーマの確認（変更不要）

Prismaスキーマに以下が定義済み:
- `Subscription` (951-970行)
- `Invoice` (972-990行)
- `PaymentMethod` (993-1013行)

### 3.2 スキーマ追加（必要な場合）

**ファイル**: `packages/db/prisma/schema.prisma`

```prisma
// Subscriptionに追加
model Subscription {
  // ... 既存フィールド
  externalId       String?           @map("external_id")      // 決済サービスID
  scheduledPlan    SubscriptionPlan? @map("scheduled_plan")   // 予定プラン
}

// Userに追加
model User {
  // ... 既存フィールド
  paymentCustomerId String? @map("payment_customer_id")  // 決済サービス顧客ID
}
```

---

## 4. セキュリティ

### 4.1 認可

- すべてのエンドポイントで `userId === req.user.id` を検証
- 既存の `requireAuth` ミドルウェアを使用

### 4.2 PCI DSS準拠

- カード番号はサーバーに送信しない（トークン化必須）
- 保存するのは `brand`, `last4`, `expiryMonth`, `expiryYear`, `externalId` のみ

### 4.3 レート制限

課金API専用のレート制限を追加: 10リクエスト/分

---

## 5. テスト計画

### 5.1 ユニットテスト

| ファイル | テスト内容 |
|----------|------------|
| `apps/api/src/__tests__/unit/subscription.service.test.ts` | サブスクリプション操作（モックゲートウェイ使用） |
| `apps/api/src/__tests__/unit/payment-method.service.test.ts` | 支払い方法操作 |

※ 日割り計算はStripeに委任するためユニットテスト不要

### 5.2 統合テスト

| ファイル | テスト内容 |
|----------|------------|
| `apps/api/src/__tests__/integration/billing.integration.test.ts` | API全体フロー |

テストケース:
- FREE→PROアップグレード成功
- 支払い方法なしでアップグレード失敗
- PRO→FREEダウングレード予約
- ダウングレード予約キャンセル

### 5.3 E2Eテスト（任意）

`apps/web/e2e/billing.spec.ts` - プラン変更UIフロー

---

## 6. 実装ファイル一覧

### バックエンド

| ファイル | 操作 |
|----------|------|
| `apps/api/src/gateways/payment/payment-gateway.interface.ts` | 新規 |
| `apps/api/src/gateways/payment/stripe.gateway.ts` | 新規 |
| `apps/api/src/gateways/payment/mock.gateway.ts` | 新規 |
| `apps/api/src/services/subscription.service.ts` | 新規 |
| `apps/api/src/services/payment-method.service.ts` | 新規 |
| `apps/api/src/repositories/subscription.repository.ts` | 新規 |
| `apps/api/src/repositories/payment-method.repository.ts` | 新規 |
| `apps/api/src/controllers/subscription.controller.ts` | 新規 |
| `apps/api/src/controllers/payment-method.controller.ts` | 新規 |
| `apps/api/src/controllers/plans.controller.ts` | 新規 |
| `apps/api/src/routes/billing.ts` | 新規 |
| `apps/api/src/routes/users.ts` | 更新 |
| `apps/api/src/routes/index.ts` | 更新 |
| `packages/shared/src/config/plan-pricing.ts` | 新規 |
| `packages/db/prisma/schema.prisma` | 更新（任意） |

### フロントエンド

| ファイル | 操作 |
|----------|------|
| `apps/web/src/lib/api.ts` | 更新 |
| `apps/web/src/pages/Settings.tsx` | 更新 |
| `apps/web/src/components/settings/BillingSettings.tsx` | 新規 |
| `apps/web/src/components/billing/CurrentPlanCard.tsx` | 新規 |
| `apps/web/src/components/billing/PaymentMethodsCard.tsx` | 新規 |
| `apps/web/src/components/billing/PlanChangeModal.tsx` | 新規 |
| `apps/web/src/components/billing/AddPaymentMethodModal.tsx` | 新規 |

---

## 7. 検証方法

### 7.1 APIテスト

```bash
# コンテナ内でテスト実行
docker compose exec dev pnpm test --filter=api
```

### 7.2 UIテスト

1. 開発サーバー起動: `cd docker && docker compose up`
2. ブラウザで `http://localhost:3000/settings?tab=billing` を開く
3. 以下を確認:
   - 現在のプラン表示
   - プラン変更モーダルの動作
   - 支払い方法の追加・削除

### 7.3 E2Eテスト（任意）

```bash
docker compose exec dev pnpm test:e2e
```

---

## 8. 実装順序

1. **Phase 1: 基盤** - IPaymentGatewayインターフェース定義、Stripe/Mockゲートウェイ実装、リポジトリ
2. **Phase 2: バックエンドAPI** - サービス、コントローラー、ルート
3. **Phase 3: フロントエンド** - API クライアント、UIコンポーネント
4. **Phase 4: テスト** - ユニットテスト、統合テスト

---

## 9. Stripe連携の補足

### 9.1 必要な環境変数

```bash
STRIPE_SECRET_KEY=sk_test_xxx       # Stripe秘密鍵
STRIPE_PUBLISHABLE_KEY=pk_test_xxx  # Stripe公開鍵（フロントエンド用）
STRIPE_WEBHOOK_SECRET=whsec_xxx     # Webhook署名検証用
```

### 9.2 Stripe Priceの事前作成

Stripeダッシュボードまたは`stripe prices create`で以下を作成:

| プラン | サイクル | Price ID |
|--------|----------|----------|
| PRO | 月額 | `price_pro_monthly` |
| PRO | 年額 | `price_pro_yearly` |

### 9.3 Webhook（将来実装）

Phase 11-Bで実装予定:
- `invoice.paid` - 請求書支払い完了
- `invoice.payment_failed` - 支払い失敗
- `customer.subscription.updated` - サブスクリプション更新
