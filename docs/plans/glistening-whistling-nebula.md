# Phase 1: スキーマ・共通設定 - 実装計画

## 1.1 Prisma スキーマ変更

**ファイル**: `packages/db/prisma/schema.prisma`

Organization モデルに `paymentCustomerId` フィールドを追加する。User モデルに既に同様のフィールドがあるため、同じパターンに従う。

```prisma
paymentCustomerId String? @unique @map("payment_customer_id") @db.VarChar(255)
```

追加後、マイグレーション生成:
```bash
docker compose exec dev pnpm --filter @agentest/db db:migrate:dev --name add_org_payment_customer_id
```

## 1.2 組織プラン料金設定

**ファイル**: `packages/shared/src/config/plan-pricing.ts`

既存の `PERSONAL_PLAN_PRICING` パターンに合わせて以下を追加:

- `OrgPlan` 型: `'TEAM'`
- `OrgPlanPricing` インターフェース: `PlanPricing` を拡張し `pricePerUser` フィールド追加（ユーザー単価）
- `ORG_PLAN_PRICING` 定数:
  - TEAM: monthlyPrice=1200, yearlyPrice=12000, stripePriceId は環境変数から取得するためプレースホルダ
- ヘルパー関数:
  - `calculateOrgYearlySavings(plan: OrgPlan)`: 年払い割引額を計算
  - `getOrgStripePriceId(plan: OrgPlan, cycle: BillingCycle)`: Stripe Price ID を返す

## 1.3 環境変数追加

**ファイル**: `apps/api/src/config/env.ts`

既存の `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_YEARLY` と同じパターンで追加:

```typescript
STRIPE_PRICE_TEAM_MONTHLY: z.string().optional(),
STRIPE_PRICE_TEAM_YEARLY: z.string().optional(),
```

## 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | Organization に paymentCustomerId 追加 |
| `packages/shared/src/config/plan-pricing.ts` | OrgPlanPricing, ORG_PLAN_PRICING, ヘルパー関数追加 |
| `apps/api/src/config/env.ts` | STRIPE_PRICE_TEAM_MONTHLY/YEARLY 追加 |

## 検証方法

1. マイグレーション適用: `docker compose exec dev pnpm --filter @agentest/db db:migrate:dev`
2. ビルド確認: `docker compose exec dev pnpm build`
3. 既存テスト通過: `docker compose exec dev pnpm test`
