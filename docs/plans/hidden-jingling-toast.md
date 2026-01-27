# Phase 3: バックエンドサービス・リポジトリ 実装計画

## 概要

既存の個人向け課金パターン（`SubscriptionService`, `PaymentMethodService`）を踏襲し、組織向けに拡張する。リポジトリ2件の拡張と、サービス3件の新規作成を行う。

## 実装順序

1. `subscription.repository.ts` に `upsertForOrganization()` 追加
2. `invoice.repository.ts` に `findBySubscriptionId()` 追加
3. `organization-subscription.service.ts` 新規作成
4. `organization-payment-method.service.ts` 新規作成
5. `organization-invoice.service.ts` 新規作成

---

## Step 1: SubscriptionRepository 拡張

**ファイル**: `apps/api/src/repositories/subscription.repository.ts`

`upsertForUser`（L132-L158）の直後に `upsertForOrganization` を追加。

```typescript
async upsertForOrganization(
  organizationId: string,
  params: Omit<CreateSubscriptionParams, 'userId' | 'organizationId'>
): Promise<Subscription> {
  return prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      externalId: params.externalId,
      plan: params.plan,
      billingCycle: params.billingCycle,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      status: params.status ?? 'ACTIVE',
      cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
    },
    update: {
      externalId: params.externalId,
      plan: params.plan,
      billingCycle: params.billingCycle,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      status: params.status ?? 'ACTIVE',
      cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
    },
  });
}
```

---

## Step 2: InvoiceRepository 拡張

**ファイル**: `apps/api/src/repositories/invoice.repository.ts`

ページネーション型と `findBySubscriptionId` メソッドを追加。

```typescript
// ページネーション型（ファイル先頭のインターフェース群に追加）
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// InvoiceRepository クラス内に追加
async findBySubscriptionId(
  subscriptionId: string,
  pagination: PaginationParams
): Promise<PaginatedResult<Invoice>> {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where: { subscriptionId } }),
  ]);

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

---

## Step 3: OrganizationSubscriptionService 新規作成

**新規ファイル**: `apps/api/src/services/organization-subscription.service.ts`

既存の `SubscriptionService`（個人向け）と同じ構造。主な違い:
- `userId` の代わりに `orgId` を使用
- `quantity`（メンバー数）の管理
- `syncMemberCount` メソッドの追加
- `Organization.plan` はキャンセル後もTEAMを維持（statusで制御）

### クラス構造

| メソッド | 説明 |
|---------|------|
| `getSubscription(orgId)` | サブスク取得 + メンバー数付きレスポンス |
| `createSubscription(orgId, input)` | 顧客確認→ゲートウェイ作成→DB upsert→plan更新 |
| `updateSubscription(orgId, input)` | billingCycle変更のみ |
| `cancelSubscription(orgId)` | cancelAtPeriodEnd=true（plan変更なし） |
| `reactivateSubscription(orgId)` | cancelAtPeriodEnd=false |
| `syncMemberCount(orgId)` | DBの実メンバー数→Stripe quantity更新 |
| `calculatePlanChange(orgId, plan, cycle)` | 料金プレビュー（ORG_PLAN_PRICING使用） |
| `ensureOrgPaymentCustomer(orgId)` [private] | paymentCustomerId確認/作成 |
| `getMemberCount(orgId)` [private] | organizationMember.count() |
| `toResponse(subscription, quantity)` [private] | レスポンス変換 |

### DI

```typescript
private subscriptionRepo = new SubscriptionRepository();
private paymentMethodRepo = new PaymentMethodRepository();
private paymentGateway: IPaymentGateway;
constructor() { this.paymentGateway = getPaymentGateway(); }
```

### ensureOrgPaymentCustomer の email 取得

`org.billingEmail` を優先。なければ OWNER メンバーの email をフォールバック。

### syncMemberCount の設計

- サブスクリプションがない場合は何もしない（return）
- 常に `prisma.organizationMember.count()` で実数を取得（差分計算しない）
- `paymentGateway.updateSubscriptionQuantity()` で Stripe を更新

---

## Step 4: OrganizationPaymentMethodService 新規作成

**新規ファイル**: `apps/api/src/services/organization-payment-method.service.ts`

既存 `PaymentMethodService`（L1-L212）とほぼ同一構造。`userId` → `orgId`、`prisma.user` → `prisma.organization` に置換。

### メソッド

| メソッド | 説明 |
|---------|------|
| `createSetupIntent(orgId)` | ensureOrgPaymentCustomer → createSetupIntent |
| `getPaymentMethods(orgId)` | findByOrganizationId |
| `addPaymentMethod(orgId, token)` | attach → countByOrganizationId → create |
| `deletePaymentMethod(orgId, pmId)` | 所有者確認 → detach → delete |
| `setDefaultPaymentMethod(orgId, pmId)` | 所有者確認 → setDefaultForOrganization |
| `ensureOrgPaymentCustomer(orgId)` [private] | Step 3と同じロジック（重複許容、既存パターン踏襲） |

---

## Step 5: OrganizationInvoiceService 新規作成

**新規ファイル**: `apps/api/src/services/organization-invoice.service.ts`

### メソッド

| メソッド | 説明 |
|---------|------|
| `getInvoices(orgId, pagination)` | orgId→サブスク取得→findBySubscriptionId |

サブスクがない場合は空の `PaginatedResult` を返す（エラーにしない）。

---

## 関連ファイル一覧

| ファイル | 操作 |
|---------|------|
| `apps/api/src/repositories/subscription.repository.ts` | 編集 |
| `apps/api/src/repositories/invoice.repository.ts` | 編集 |
| `apps/api/src/services/organization-subscription.service.ts` | 新規 |
| `apps/api/src/services/organization-payment-method.service.ts` | 新規 |
| `apps/api/src/services/organization-invoice.service.ts` | 新規 |

### 参照ファイル（変更なし）

- `apps/api/src/services/subscription.service.ts` - パターン参照元
- `apps/api/src/services/payment-method.service.ts` - パターン参照元
- `apps/api/src/repositories/payment-method.repository.ts` - 組織対応済み
- `apps/api/src/gateways/payment/payment-gateway.interface.ts` - Phase 2で実装済み
- `packages/shared/src/config/plan-pricing.ts` - OrgPlan, ORG_PLAN_PRICING

---

## 検証方法

1. `docker compose exec dev pnpm build` でコンパイルエラーがないことを確認
2. `docker compose exec dev pnpm test` で既存テスト通過を確認
3. import/export の整合性確認（新規サービスが正しく参照できること）
