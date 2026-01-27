# Phase 2: ゲートウェイ層拡張 - 実装計画

## 概要

既存の個人プラン向け決済ゲートウェイ（`IPaymentGateway`）に、組織サブスクリプション用のメソッドと型を追加する。
組織プランはユーザー単価制（`quantity`）を持つ点が個人プランと異なる。

---

## 変更対象ファイル

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `apps/api/src/gateways/payment/types.ts` | 組織サブスクリプション用の型追加 |
| 2 | `apps/api/src/gateways/payment/payment-gateway.interface.ts` | インターフェースに3メソッド追加 |
| 3 | `apps/api/src/gateways/payment/stripe.gateway.ts` | Stripe実装追加 |
| 4 | `apps/api/src/gateways/payment/mock.gateway.ts` | モック実装追加 |

---

## Step 1: 型定義追加 (`types.ts`)

既存の `CreateSubscriptionParams` / `UpdateSubscriptionParams` / `SubscriptionResult` と並列に、組織用の型を追加する。

```typescript
import type { BillingCycle, OrgPlan } from '@agentest/shared';

/**
 * 組織サブスクリプション作成パラメータ
 */
export interface CreateOrgSubscriptionParams {
  customerId: string;
  plan: OrgPlan;              // 'TEAM'
  billingCycle: BillingCycle;
  paymentMethodId: string;
  quantity: number;            // メンバー数
}

/**
 * 組織サブスクリプション更新パラメータ
 */
export interface UpdateOrgSubscriptionParams {
  billingCycle?: BillingCycle;
  quantity?: number;
}

/**
 * 組織サブスクリプション結果
 * SubscriptionResult を拡張し quantity フィールドを追加
 */
export interface OrgSubscriptionResult {
  id: string;
  customerId: string;
  status: SubscriptionResult['status'];
  plan: OrgPlan;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  quantity: number;
}
```

**設計判断**: `SubscriptionResult` を直接拡張（`extends`）せず独立した型として定義する。理由: `plan` フィールドの型が `PersonalPlan` vs `OrgPlan` で異なるため、型安全性を保つ。

---

## Step 2: インターフェース拡張 (`payment-gateway.interface.ts`)

`IPaymentGateway` に以下3メソッドを追加する。

```typescript
// 組織サブスクリプション管理セクションを追加

/**
 * 組織サブスクリプションを作成
 */
createOrgSubscription(
  params: CreateOrgSubscriptionParams
): Promise<OrgSubscriptionResult>;

/**
 * 組織サブスクリプションを更新（請求サイクル変更等）
 */
updateOrgSubscription(
  subscriptionId: string,
  params: UpdateOrgSubscriptionParams
): Promise<OrgSubscriptionResult>;

/**
 * サブスクリプションの数量（メンバー数）を更新
 */
updateSubscriptionQuantity(
  subscriptionId: string,
  quantity: number
): Promise<OrgSubscriptionResult>;
```

import文に `CreateOrgSubscriptionParams`, `UpdateOrgSubscriptionParams`, `OrgSubscriptionResult` を追加する。

---

## Step 3: StripeGateway 実装 (`stripe.gateway.ts`)

### 3.1 `resolveOrgPriceId` メソッド追加

既存の `resolvePriceId`（PersonalPlan用）と並列に、組織プラン用のPrice ID解決メソッドを追加。

```typescript
private resolveOrgPriceId(plan: OrgPlan, cycle: BillingCycle): string {
  if (cycle === 'MONTHLY') {
    const priceId = env.STRIPE_PRICE_TEAM_MONTHLY;
    if (!priceId) {
      throw new Error('STRIPE_PRICE_TEAM_MONTHLY is not configured');
    }
    return priceId;
  }
  const priceId = env.STRIPE_PRICE_TEAM_YEARLY;
  if (!priceId) {
    throw new Error('STRIPE_PRICE_TEAM_YEARLY is not configured');
  }
  return priceId;
}
```

### 3.2 `createOrgSubscription` 実装

```typescript
async createOrgSubscription(
  params: CreateOrgSubscriptionParams
): Promise<OrgSubscriptionResult> {
  const priceId = this.resolveOrgPriceId(params.plan, params.billingCycle);

  const subscription = await this.stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: priceId, quantity: params.quantity }],
    default_payment_method: params.paymentMethodId,
    metadata: {
      plan: params.plan,
      billingCycle: params.billingCycle,
      type: 'organization',
    },
  });

  return this.toOrgSubscriptionResult(subscription);
}
```

### 3.3 `updateOrgSubscription` 実装

```typescript
async updateOrgSubscription(
  subscriptionId: string,
  params: UpdateOrgSubscriptionParams
): Promise<OrgSubscriptionResult> {
  const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
  const currentItemId = subscription.items.data[0]?.id;
  if (!currentItemId) {
    throw new Error('Subscription has no items');
  }

  const updateParams: Stripe.SubscriptionUpdateParams = {
    proration_behavior: 'create_prorations',
  };

  if (params.billingCycle !== undefined) {
    const plan = subscription.metadata.plan as OrgPlan;
    const newPriceId = this.resolveOrgPriceId(plan, params.billingCycle);
    updateParams.items = [{ id: currentItemId, price: newPriceId }];
    updateParams.metadata = {
      ...subscription.metadata,
      billingCycle: params.billingCycle,
    };
  }

  if (params.quantity !== undefined) {
    // items が未設定の場合は既存アイテムの数量のみ更新
    if (!updateParams.items) {
      updateParams.items = [{ id: currentItemId, quantity: params.quantity }];
    } else {
      updateParams.items[0].quantity = params.quantity;
    }
  }

  const updated = await this.stripe.subscriptions.update(subscriptionId, updateParams);
  return this.toOrgSubscriptionResult(updated);
}
```

### 3.4 `updateSubscriptionQuantity` 実装

```typescript
async updateSubscriptionQuantity(
  subscriptionId: string,
  quantity: number
): Promise<OrgSubscriptionResult> {
  const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
  const currentItemId = subscription.items.data[0]?.id;
  if (!currentItemId) {
    throw new Error('Subscription has no items');
  }

  const updated = await this.stripe.subscriptions.update(subscriptionId, {
    items: [{ id: currentItemId, quantity }],
    proration_behavior: 'create_prorations',
  });

  return this.toOrgSubscriptionResult(updated);
}
```

### 3.5 `toOrgSubscriptionResult` ヘルパー追加

既存の `toSubscriptionResult` と類似。`quantity` フィールドと `OrgPlan` 型を使う点が異なる。

```typescript
private toOrgSubscriptionResult(sub: Stripe.Subscription): OrgSubscriptionResult {
  // statusMap は toSubscriptionResult と同一
  const firstItem = sub.items.data[0];
  if (!firstItem) {
    throw new Error(`Subscription ${sub.id} has no items`);
  }

  return {
    id: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    status: statusMap[sub.status] ?? 'incomplete',
    plan: (sub.metadata.plan as OrgPlan) ?? 'TEAM',
    billingCycle: (sub.metadata.billingCycle as BillingCycle) ?? 'MONTHLY',
    currentPeriodStart: new Date(firstItem.current_period_start * 1000),
    currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    quantity: firstItem.quantity ?? 1,
  };
}
```

### 3.6 import 追加

`OrgPlan` を `@agentest/shared` から、新しい型を `./types.js` から import。

---

## Step 4: MockGateway 実装 (`mock.gateway.ts`)

### 4.1 ストア拡張

```typescript
interface MockStore {
  // ... 既存フィールド
  orgSubscriptions: Map<string, OrgSubscriptionResult>;
}
```

`reset()` メソッドにも `orgSubscriptions: new Map()` を追加。

### 4.2 `createOrgSubscription` 実装

既存の `createSubscription` パターンを踏襲。`quantity` を含む `OrgSubscriptionResult` を生成。
`ORG_PLAN_PRICING` を使用して請求書を作成（金額 = `pricePerUser * quantity`）。

### 4.3 `updateOrgSubscription` 実装

`billingCycle` と `quantity` の更新をサポート。

### 4.4 `updateSubscriptionQuantity` 実装

ストアから取得して `quantity` を更新して返す。

### 4.5 import 追加

`OrgPlan`, `ORG_PLAN_PRICING` を `@agentest/shared` から、新しい型を `./types.js` から import。

---

## 既存メソッドへの影響

- 既存の `cancelSubscription` / `reactivateSubscription` / `getSubscription` は**変更不要**。
- 組織サブスクリプションのキャンセル・再開にも既存メソッドを共用する。
- Phase 3 のサービス層で、これらのメソッド呼び出し後に必要に応じて `OrgSubscriptionResult` への変換を行う。

---

## 検証方法

1. `docker compose exec dev pnpm build` でコンパイルエラーがないことを確認
2. `docker compose exec dev pnpm test` で既存テストが通ることを確認
3. `IPaymentGateway` の全実装クラス（StripeGateway, MockGateway）が新メソッドを実装していることをTypeScriptコンパイラが保証
