# Phase 4: コントローラー・ルート実装計画

## 概要

組織向けBilling APIのコントローラーとルート登録を実装する。
既存の個人向けBillingパターン（`subscription.controller.ts`、`payment-method.controller.ts`）を踏襲し、組織向けに適用する。

---

## 実装ファイル一覧

| ファイル | 種別 |
|---------|------|
| `apps/api/src/controllers/organization-billing.controller.ts` | **新規作成** |
| `apps/api/src/routes/organizations.ts` | 修正 |
| `apps/api/src/controllers/plans.controller.ts` | 修正 |
| `apps/api/src/routes/billing.ts` | 修正 |

---

## Step 1: OrganizationBillingController 新規作成

**ファイル**: `apps/api/src/controllers/organization-billing.controller.ts`

### 構造

```typescript
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrganizationSubscriptionService } from '../services/organization-subscription.service';
import { OrganizationPaymentMethodService } from '../services/organization-payment-method.service';
import { OrganizationInvoiceService } from '../services/organization-invoice.service';

// バリデーションスキーマ
const createSubscriptionSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  paymentMethodId: z.string(),
});

const updateSubscriptionSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

const addPaymentMethodSchema = z.object({
  token: z.string(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export class OrganizationBillingController {
  private subscriptionService = new OrganizationSubscriptionService();
  private paymentMethodService = new OrganizationPaymentMethodService();
  private invoiceService = new OrganizationInvoiceService();

  // === Subscription ===
  getSubscription = async (req, res, next) => { ... };
  createSubscription = async (req, res, next) => { ... };
  updateSubscription = async (req, res, next) => { ... };
  cancelSubscription = async (req, res, next) => { ... };
  reactivateSubscription = async (req, res, next) => { ... };
  calculatePlanChange = async (req, res, next) => { ... };

  // === Payment Methods ===
  getPaymentMethods = async (req, res, next) => { ... };
  addPaymentMethod = async (req, res, next) => { ... };
  deletePaymentMethod = async (req, res, next) => { ... };
  setDefaultPaymentMethod = async (req, res, next) => { ... };
  createSetupIntent = async (req, res, next) => { ... };

  // === Invoices ===
  getInvoices = async (req, res, next) => { ... };
}

export const organizationBillingController = new OrganizationBillingController();
```

### メソッド詳細

#### Subscription系（6メソッド）

| メソッド | エンドポイント | 処理内容 |
|---------|---------------|----------|
| `getSubscription` | `GET /:orgId/subscription` | サブスク取得、なければ`null`返却 |
| `createSubscription` | `POST /:orgId/subscription` | TEAM契約開始、201返却 |
| `updateSubscription` | `PUT /:orgId/subscription` | 請求サイクル変更 |
| `cancelSubscription` | `DELETE /:orgId/subscription` | キャンセル（期間終了時） |
| `reactivateSubscription` | `POST /:orgId/subscription/reactivate` | キャンセル取消 |
| `calculatePlanChange` | `GET /:orgId/subscription/calculate` | 料金プレビュー |

#### PaymentMethod系（5メソッド）

| メソッド | エンドポイント | 処理内容 |
|---------|---------------|----------|
| `getPaymentMethods` | `GET /:orgId/payment-methods` | 支払い方法一覧 |
| `addPaymentMethod` | `POST /:orgId/payment-methods` | 支払い方法追加 |
| `deletePaymentMethod` | `DELETE /:orgId/payment-methods/:pmId` | 支払い方法削除 |
| `setDefaultPaymentMethod` | `PUT /:orgId/payment-methods/:pmId/default` | デフォルト設定 |
| `createSetupIntent` | `POST /:orgId/payment-methods/setup-intent` | SetupIntent作成 |

#### Invoice系（1メソッド）

| メソッド | エンドポイント | 処理内容 |
|---------|---------------|----------|
| `getInvoices` | `GET /:orgId/invoices` | 請求履歴（ページネーション） |

### 実装パターン（既存コントローラー準拠）

```typescript
getSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const subscription = await this.subscriptionService.getSubscription(organizationId);
    res.json({ subscription });
  } catch (error) {
    next(error);
  }
};

createSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const input = createSubscriptionSchema.parse(req.body);
    const subscription = await this.subscriptionService.createSubscription(organizationId, input);
    res.status(201).json({ subscription });
  } catch (error) {
    next(error);
  }
};

calculatePlanChange = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { billingCycle } = z.object({
      billingCycle: z.enum(['MONTHLY', 'YEARLY']),
    }).parse(req.query);

    const calculation = await this.subscriptionService.calculatePlanChange(
      organizationId,
      'TEAM',  // 現在TEAMのみ対応
      billingCycle
    );
    res.json({ calculation });
  } catch (error) {
    next(error);
  }
};

getInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const pagination = paginationSchema.parse(req.query);
    const result = await this.invoiceService.getInvoices(organizationId, pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
```

---

## Step 2: ルート登録（organizations.ts）

**ファイル**: `apps/api/src/routes/organizations.ts`

### 追加するimport

```typescript
import { organizationBillingController } from '../controllers/organization-billing.controller';
import { billingLimiter } from './rate-limiters';
```

### 追加するルート定義

```typescript
// === 組織Billing ===
// Subscription
router.get(
  '/:organizationId/subscription',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  organizationBillingController.getSubscription
);

router.post(
  '/:organizationId/subscription',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.createSubscription
);

router.put(
  '/:organizationId/subscription',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.updateSubscription
);

router.delete(
  '/:organizationId/subscription',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.cancelSubscription
);

router.post(
  '/:organizationId/subscription/reactivate',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.reactivateSubscription
);

router.get(
  '/:organizationId/subscription/calculate',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.calculatePlanChange
);

// Payment Methods
router.get(
  '/:organizationId/payment-methods',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  organizationBillingController.getPaymentMethods
);

router.post(
  '/:organizationId/payment-methods',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.addPaymentMethod
);

router.delete(
  '/:organizationId/payment-methods/:pmId',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.deletePaymentMethod
);

router.put(
  '/:organizationId/payment-methods/:pmId/default',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.setDefaultPaymentMethod
);

router.post(
  '/:organizationId/payment-methods/setup-intent',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  billingLimiter,
  organizationBillingController.createSetupIntent
);

// Invoices
router.get(
  '/:organizationId/invoices',
  requireAuth(authConfig),
  requireOrgRole(['OWNER', 'ADMIN']),
  organizationBillingController.getInvoices
);
```

### ミドルウェア設定

- **認証**: `requireAuth(authConfig)` - 全エンドポイント
- **認可**: `requireOrgRole(['OWNER', 'ADMIN'])` - 全エンドポイント
- **レート制限**: `billingLimiter` - 変更系エンドポイント（POST/PUT/DELETE）

---

## Step 3: プラン一覧API拡張（plans.controller.ts）

**ファイル**: `apps/api/src/controllers/plans.controller.ts`

### 追加するimport

```typescript
import { ORG_PLAN_PRICING, calculateOrgYearlySavings } from '@agentest/shared';
import type { OrgPlan } from '@agentest/shared';
```

### 追加するメソッド

```typescript
/**
 * 組織プラン一覧取得（認証不要）
 * GET /api/plans/organization
 */
getOrgPlans = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plans = (Object.keys(ORG_PLAN_PRICING) as OrgPlan[]).map((plan) => {
      const pricing = ORG_PLAN_PRICING[plan];
      return {
        plan,
        pricePerUser: pricing.pricePerUser,
        monthlyPrice: pricing.monthlyPrice,
        yearlyPrice: pricing.yearlyPrice,
        yearlySavings: calculateOrgYearlySavings(plan),
        features: pricing.features,
      };
    });
    res.json({ plans });
  } catch (error) {
    next(error);
  }
};
```

---

## Step 4: ルート登録（billing.ts）

**ファイル**: `apps/api/src/routes/billing.ts`

### 追加するルート

```typescript
// 組織プラン一覧（認証不要）
router.get('/plans/organization', plansController.getOrgPlans);
```

---

## エンドポイント一覧（完成形）

### 組織Billing API（`/api/organizations/:orgId/...`）

| Method | Path | 説明 | 認可 | Rate Limit |
|--------|------|------|------|------------|
| GET | `/subscription` | サブスク取得 | OWNER/ADMIN | - |
| POST | `/subscription` | TEAM契約開始 | OWNER/ADMIN | ✓ |
| PUT | `/subscription` | 請求サイクル変更 | OWNER/ADMIN | ✓ |
| DELETE | `/subscription` | キャンセル | OWNER/ADMIN | ✓ |
| POST | `/subscription/reactivate` | キャンセル取消 | OWNER/ADMIN | ✓ |
| GET | `/subscription/calculate` | 料金計算 | OWNER/ADMIN | ✓ |
| GET | `/payment-methods` | 支払い方法一覧 | OWNER/ADMIN | - |
| POST | `/payment-methods` | 支払い方法追加 | OWNER/ADMIN | ✓ |
| DELETE | `/payment-methods/:pmId` | 支払い方法削除 | OWNER/ADMIN | ✓ |
| PUT | `/payment-methods/:pmId/default` | デフォルト設定 | OWNER/ADMIN | ✓ |
| POST | `/payment-methods/setup-intent` | SetupIntent作成 | OWNER/ADMIN | ✓ |
| GET | `/invoices` | 請求履歴 | OWNER/ADMIN | - |

### プラン情報API（`/api/plans/...`）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | `/organization` | 組織プラン一覧 | 不要 |

---

## 検証方法

### 1. ユニットテスト実行

```bash
docker compose exec dev pnpm test -- --grep "organization-billing"
```

### 2. API動作確認（curl）

```bash
# 組織プラン一覧（認証不要）
curl http://localhost:3000/api/plans/organization

# サブスクリプション取得
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/organizations/$ORG_ID/subscription

# TEAM契約開始
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"billingCycle":"MONTHLY","paymentMethodId":"pm_xxx"}' \
  http://localhost:3000/api/organizations/$ORG_ID/subscription

# 料金計算
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/organizations/$ORG_ID/subscription/calculate?billingCycle=YEARLY"

# 請求履歴
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/organizations/$ORG_ID/invoices?page=1&limit=20"
```

### 3. 認可テスト

- OWNER/ADMINロールでアクセス可能
- MEMBERロールで403エラー
- 未認証で401エラー

---

## 実装順序

1. `organization-billing.controller.ts` 新規作成
2. `routes/organizations.ts` にルート追加
3. `plans.controller.ts` に `getOrgPlans` 追加
4. `routes/billing.ts` にルート追加
5. 動作確認
