# 課金システム全体削除 - TDD実装計画

## Context

AgentestをSaaSからOSSに転換するため、課金システム全体（Stripe連携、サブスクリプション、支払い方法、請求書、プラン制限、使用量管理）を削除する。TDD（テスト先行開発）で「RED → GREEN → REFACTOR」サイクルを適用し、各ステップでテスト修正→テスト通過確認→プロダクションコード変更の順序を守る。

**影響規模**: 約136ファイル（削除50+、修正30+、テスト削除37、テスト修正14、テスト新規1）

---

## 依存関係グラフ

```
Phase 1: DBスキーマ + 共有パッケージ（packages/db, packages/shared）
    ↓
Phase 2: API - 課金専用モジュール一括削除
    ↓
Phase 3: API - 非課金コード内の課金参照除去
    ↓（Phase 3完了後、4-6は並行可能）
Phase 4: バッチジョブ（apps/jobs）
Phase 5: Web フロントエンド（apps/web）
Phase 6: Admin フロントエンド（apps/admin）
    ↓
Phase 7: 環境変数・設定ファイルのクリーンアップ + 最終検証
```

**重要**: Phase 1は全後続フェーズの前提条件。1ブランチで全フェーズを順次実行する。

---

## Phase 1: DBスキーマ + 共有パッケージ

**目的**: Prismaスキーマと共通型を先に修正し、型レベルでの整合性を確保。

### Step 1-1: Prismaスキーマから課金モデル削除

**ファイル**: `packages/db/prisma/schema.prisma`

1. **TDD-RED**: Prismaスキーマ変更 → `prisma generate` で型が変わる → 下流テスト全体が赤くなる（想定通り）
2. **変更内容**:
   - **削除Enum**: `SubscriptionPlan`, `SubscriptionStatus`, `BillingCycle`, `InvoiceStatus`, `PaymentEventStatus`, `PaymentMethodType`
   - **削除Enum**: `UserPlan`, `OrganizationPlan`
   - **修正Enum**: `NotificationType`から`USAGE_ALERT`/`BILLING`削除、`AuditLogCategory`から`BILLING`削除
   - **削除モデル**: `Subscription`, `Invoice`, `PaymentEvent`, `PaymentMethod`, `UsageRecord`, `PlanDistributionMetric`
   - **Userモデル修正**: `plan`, `paymentCustomerId` フィールド削除、`subscription`/`paymentMethods`/`usageRecords` リレーション削除
   - **Organizationモデル修正**: `plan`, `paymentCustomerId`, `billingEmail` フィールド削除、`subscription`/`paymentMethods`/`usageRecords` リレーション削除
   - **残す**: `ActiveUserMetric`モデル、`MetricGranularity` enum（DAU/WAU/MAU集計、課金無関係）
3. **マイグレーション作成**:
   ```bash
   docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name remove_billing_system
   ```

### Step 1-2: seed.ts の修正

**ファイル**: `packages/db/prisma/seed.ts`

- `UserPlan`, `OrganizationPlan` import削除
- `plan: UserPlan.PRO` → 削除
- `plan: OrganizationPlan.TEAM` → 削除
- `billingEmail: 'billing@demo-org.dev'` → 削除

### Step 1-3: enums.ts から課金enum削除

**ファイル**: `packages/shared/src/types/enums.ts`

- **完全削除**: `UserPlan`(L2-6), `OrganizationPlan`(L8-13), `SubscriptionPlan`(L124-130), `SubscriptionStatus`(L132-138), `BillingCycle`(L140-144), `InvoiceStatus`(L146-152), `PaymentMethodType`(L154-157)
- **修正**: `NotificationType`から`USAGE_ALERT`/`BILLING`削除、`AuditLogCategory`から`BILLING`削除

### Step 1-4: plan-pricing.ts 全体削除

- **削除**: `packages/shared/src/config/plan-pricing.ts`
- **修正**: `packages/shared/src/config/index.ts` → `export * from './plan-pricing.js'` 削除

### Step 1-5: 共有型定義の修正

| ファイル | 変更内容 |
|---------|---------|
| `types/user.ts` | `import UserPlan`削除、`User.plan`/`UserPublic.plan`削除 |
| `types/admin-dashboard.ts` | `AdminDashboardUserStats.byPlan`/`AdminDashboardOrgStats.byPlan`削除、`AdminDashboardRevenueStats`全体削除、`AdminDashboardStats.revenue`削除 |
| `types/admin-users.ts` | `AdminUserSearchParams.plan`/`AdminUserSortBy:'plan'`/`AdminUserListItem.plan`/`AdminUserDetail.plan`/`AdminUserSubscription`全体/`AdminUserDetail.subscription`削除 |
| `types/admin-organizations.ts` | `AdminOrganizationSortBy:'plan'`/`AdminOrganizationSearchParams.plan`/`AdminOrganizationListItem.plan,billingEmail`/`AdminOrganizationDetail.plan,billingEmail,paymentCustomerId`/`AdminOrganizationSubscription`全体/`AdminOrganizationDetail.subscription`削除 |

### Step 1-6: バリデーションスキーマの修正

**ファイル**: `packages/shared/src/validators/schemas.ts`

- `userPlanSchema`, `organizationPlanSchema` 削除
- `organizationCreateSchema`/`organizationUpdateSchema`から`billingEmail`削除
- `adminUserSearchSchema`の`plan`フィールド/`sortBy:'plan'`削除
- `adminOrganizationSearchSchema`の`plan`フィールド/`sortBy:'plan'`削除
- `planDistributionQuerySchema`全体と`PlanDistributionQuery`型削除
- `auditLogCategories`配列から`BILLING`除去

### Step 1-7: 共有パッケージのテスト検証

```bash
docker compose exec dev pnpm --filter @agentest/shared test
docker compose exec dev pnpm --filter @agentest/db build
```

---

## Phase 2: API - 課金専用モジュール一括削除

**目的**: 非課金コードから参照されない独立課金モジュールとそのテストを一括削除。

### Step 2-1: 課金専用テスト一括削除（約25ファイル）

**TDD-RED**: これらのテストは Phase 1 のスキーマ変更で既にコンパイルエラーになっている。削除してクリーンにする。

**統合テスト**（`apps/api/src/__tests__/integration/`）:
- `billing.integration.test.ts`
- `organization-billing.integration.test.ts`
- `webhook.integration.test.ts`
- `admin-metrics.integration.test.ts`

**ユニットテスト**（`apps/api/src/__tests__/unit/`）:
- `subscription.controller.test.ts`, `subscription.service.test.ts`, `subscription.repository.test.ts`
- `organization-subscription.service.test.ts`, `organization-billing.controller.test.ts`
- `organization-payment-method.service.test.ts`, `organization-invoice.service.test.ts`
- `payment-method.controller.test.ts`, `payment-method.service.test.ts`, `payment-method.repository.test.ts`
- `payment-event.repository.test.ts`, `invoice.repository.test.ts`
- `user-invoice.controller.test.ts`, `user-invoice.service.test.ts`
- `webhook.controller.test.ts`, `webhook.service.test.ts`
- `stripe.gateway.test.ts`, `mock.gateway.test.ts`
- `plans.controller.test.ts`, `project.service.plan-check.test.ts`
- `admin-metrics.controller.test.ts`, `admin-metrics.service.test.ts`

### Step 2-2: 課金専用プロダクションコード一括削除

**ディレクトリ削除**:
- `apps/api/src/gateways/payment/` (5ファイル)

**サービス削除**（`apps/api/src/services/`）:
- `subscription.service.ts`, `organization-subscription.service.ts`
- `organization-payment-method.service.ts`, `organization-invoice.service.ts`
- `user-invoice.service.ts`, `payment-method.service.ts`, `webhook.service.ts`
- `admin/admin-metrics.service.ts`

**コントローラー削除**（`apps/api/src/controllers/`）:
- `plans.controller.ts`, `subscription.controller.ts`, `organization-billing.controller.ts`
- `payment-method.controller.ts`, `user-invoice.controller.ts`, `webhook.controller.ts`
- `admin/metrics.controller.ts`

**リポジトリ削除**（`apps/api/src/repositories/`）:
- `subscription.repository.ts`, `invoice.repository.ts`
- `payment-method.repository.ts`, `payment-event.repository.ts`

**ルート削除**（`apps/api/src/routes/`）:
- `billing.ts`, `webhooks.ts`, `admin/metrics.ts`

### Step 2-3: テストヘルパーから課金ヘルパー削除

- `apps/api/src/__tests__/integration/test-helpers.ts`: `createTestPaymentMethod`, `createTestOrgPaymentMethod`, `createTestSubscription`, `createTestInvoice` 削除。`cleanupTestData()`から課金テーブル削除順序除去
- `apps/jobs/src/__tests__/integration/test-helpers.ts`: `createTestSubscription`, `createTestPaymentEvent`, `createTestInvoice` 削除

---

## Phase 3: API - 非課金コード内の課金参照除去

**目的**: 課金とコアロジックの結合点を解消。各ステップでTDDサイクルを適用。

### Step 3-1: ProjectService.create() のプランチェック削除

**TDD-RED**: 新規テスト作成

**新規テストファイル**: `apps/api/src/__tests__/unit/project.service.org-check.test.ts`
```
テストケース:
1. 組織プロジェクト作成: 存在しない組織 → NotFoundError
2. 組織プロジェクト作成: 組織が存在 → プランに関係なく正常作成
3. 個人プロジェクト（organizationId=null）→ 組織チェックなし正常作成
```

**TDD-GREEN**: `apps/api/src/services/project.service.ts`
- L36-42のプランチェック（`org.plan === 'NONE'` → `BusinessError`）削除
- L29: `select: { plan: true }` → `select: { id: true }` に変更
- `BusinessError`のimportが不要になれば除去

**検証**: `docker compose exec dev pnpm --filter api test -- project.service`

### Step 3-2: OrganizationService の課金依存削除

**TDD-RED**: テスト修正
- `apps/api/src/__tests__/unit/organization.service.test.ts` → syncMemberCount関連テスト削除、billingEmail削除

**TDD-GREEN**: `apps/api/src/services/organization.service.ts`
- L4: `import { OrganizationSubscriptionService }` 削除
- L14: `private orgSubscriptionService` 削除
- L70: `update()`シグネチャから`billingEmail`削除
- L351-359: `acceptInvitation()`のsyncMemberCount try-catch全体削除
- L465-473: `removeMember()`のsyncMemberCount try-catch全体削除

**検証**: `docker compose exec dev pnpm --filter api test -- organization.service`

### Step 3-3: OrganizationController / Repository の billingEmail 削除

**TDD-RED**: テスト修正
- `apps/api/src/__tests__/unit/organization.controller.crud.test.ts` → billingEmail関連テスト修正
- `apps/api/src/__tests__/unit/organization.repository.test.ts` → billingEmail関連テスト修正

**TDD-GREEN**:
- `apps/api/src/controllers/organization.controller.ts` → updateOrgSchemaからbillingEmail削除
- `apps/api/src/repositories/organization.repository.ts` → update()からbillingEmail削除

### Step 3-4: UserRepository の plan 関連削除

- `apps/api/src/repositories/user.repository.ts` → `updatePlan()`メソッド削除、`UserPlan` import削除

### Step 3-5: AdminDashboardService の課金統計削除

**TDD-RED**: テスト修正
- `apps/api/src/__tests__/unit/admin-dashboard.service.test.ts` → revenue/byPlanアサーション削除
- `apps/api/src/__tests__/unit/admin-dashboard.controller.test.ts` → revenueモック削除
- `apps/api/src/__tests__/integration/admin-dashboard.integration.test.ts` → revenue/byPlanアサーション削除

**TDD-GREEN**: `apps/api/src/services/admin/admin-dashboard.service.ts`
- L23-36: `PLAN_MONTHLY_PRICES`/`PLAN_YEARLY_PRICES`定数削除
- `getDashboard()`: `revenue`をPromise.allとstatsオブジェクトから除去
- `getUserStats()`: freeCount/proCountクエリと`byPlan`レスポンス削除
- `getOrgStats()`: teamCount/enterpriseCountクエリと`byPlan`レスポンス削除
- `getRevenueStats()`メソッド全体削除
- import文から`AdminDashboardRevenueStats`除去

### Step 3-6: AdminOrganizationsService の課金参照削除

**TDD-RED**: テスト修正
- `apps/api/src/__tests__/unit/admin-organizations.service.test.ts`
- `apps/api/src/__tests__/unit/admin-organizations.controller.test.ts`
- `apps/api/src/__tests__/integration/admin-organizations.integration.test.ts`

**TDD-GREEN**: `apps/api/src/services/admin/admin-organizations.service.ts`
- 一覧レスポンスから`billingEmail`除去
- 詳細クエリから`subscription: true`除去
- 詳細レスポンスから`billingEmail`/`paymentCustomerId`/`subscription`除去

### Step 3-7: AdminUsersService の課金参照削除

**TDD-RED**: テスト修正
- `apps/api/src/__tests__/unit/admin-users.service.test.ts`

**TDD-GREEN**: `apps/api/src/services/admin/admin-users.service.ts`
- 詳細クエリから`subscription: true`除去
- 詳細レスポンスから`subscription`除去

### Step 3-8: ルート定義の課金ルート削除

**ファイル**: `apps/api/src/routes/index.ts`
- billingRoutes/webhookRoutes/adminMetricsRoutes のimportと登録を削除

**ファイル**: `apps/api/src/routes/users.ts`
- L5-7: SubscriptionController/PaymentMethodController/UserInvoiceController import削除
- L14-16: コントローラーインスタンス生成削除
- L91-174: サブスクリプション/支払い方法/請求書ルート全体削除

**ファイル**: `apps/api/src/routes/organizations.ts`
- organizationBillingController importと課金ルート全体削除

### Step 3-9: app.ts / env.ts / redis-store.ts の課金設定削除

**ファイル**: `apps/api/src/app.ts`
- L45-46: Stripe webhook raw body設定削除

**ファイル**: `apps/api/src/config/env.ts`
- L65-72: `PAYMENT_GATEWAY`/`STRIPE_*` 7項目削除

**ファイル**: `apps/api/src/lib/redis-store.ts`
- KEY_PREFIXから`USER_INVOICES`/`ORG_INVOICES`/`ADMIN_METRICS`削除
- `setUserInvoicesCache`/`getUserInvoicesCache`/`invalidateUserInvoicesCache` 削除
- `setOrgInvoicesCache`/`getOrgInvoicesCache`/`invalidateOrgInvoicesCache` 削除
- `setAdminMetricsCache`/`getAdminMetricsCache`/`invalidateAdminMetricsCache` 削除

### Step 3-10: API全体テスト検証

```bash
docker compose exec dev pnpm --filter api test
docker compose exec dev pnpm --filter api build
```

---

## Phase 4: バッチジョブ（apps/jobs）

### Step 4-1: 課金ジョブのテスト削除

**ユニットテスト**（`apps/jobs/src/__tests__/unit/`）:
- `subscription-sync.test.ts`, `payment-event-cleanup.test.ts`
- `plan-distribution-aggregation.test.ts`, `webhook-retry.test.ts`

**統合テスト**（`apps/jobs/src/__tests__/integration/`）:
- `subscription-sync.integration.test.ts`, `payment-event-cleanup.integration.test.ts`
- `webhook-retry.integration.test.ts`

### Step 4-2: history-cleanup テスト修正（TDD-RED）

**ファイル**: `apps/jobs/src/__tests__/unit/history-cleanup.test.ts`

```
修正ポイント:
- テスト名: 「FREEプランユーザーの〜」→「保持日数を超過した履歴の〜」
- prisma.user.findManyのwhereアサーション: { subscription: { plan: 'FREE' } } → { deletedAt: null }
- 新規テスト追加: 環境変数HISTORY_RETENTION_DAYSのカスタム値テスト（デフォルト30日）
```

**ファイル**: `apps/jobs/src/__tests__/integration/history-cleanup.integration.test.ts`
- FREEプラン前提のデータセットアップを全ユーザー対象に修正

### Step 4-3: history-cleanup.ts の修正（TDD-GREEN）

**ファイル**: `apps/jobs/src/jobs/history-cleanup.ts`

```typescript
// Before:
import { PLAN_LIMITS } from '@agentest/shared';
cutoffDate.setDate(cutoffDate.getDate() - PLAN_LIMITS.FREE.changeHistoryDays);
const users = await prisma.user.findMany({
  where: { subscription: { plan: 'FREE' } },

// After:
const HISTORY_RETENTION_DAYS = Number(process.env.HISTORY_RETENTION_DAYS) || 30;
cutoffDate.setDate(cutoffDate.getDate() - HISTORY_RETENTION_DAYS);
const users = await prisma.user.findMany({
  where: { deletedAt: null },
```

### Step 4-4: 課金ジョブのプロダクションコード削除

**削除**:
- `apps/jobs/src/jobs/subscription-sync.ts`
- `apps/jobs/src/jobs/webhook-retry.ts`
- `apps/jobs/src/jobs/payment-event-cleanup.ts`
- `apps/jobs/src/jobs/plan-distribution-aggregation.ts`
- `apps/jobs/src/jobs/metrics-aggregation.ts`
- `apps/jobs/src/jobs/metrics-backfill.ts`
- `apps/jobs/src/lib/stripe.ts`

### Step 4-5: index.ts の課金ジョブ登録削除

**ファイル**: `apps/jobs/src/index.ts` → 上記ジョブのimportと登録を削除

**検証**: `docker compose exec dev pnpm --filter jobs test && docker compose exec dev pnpm --filter jobs build`

---

## Phase 5: Web フロントエンド（apps/web）

### Step 5-1: テスト削除・修正

- **削除**: `apps/web/src/lib/__tests__/billing.test.ts`
- **修正**: `apps/web/src/__tests__/factories.ts` → `plan`フィールド削除
- **修正**: 設定画面テストがあれば`plan`参照修正

### Step 5-2: 課金コンポーネント・ユーティリティ削除

**ディレクトリ削除**:
- `apps/web/src/components/billing/` (CurrentPlanCard, PlanChangeModal, AddPaymentMethodModal, PaymentMethodsCard, InvoiceList)
- `apps/web/src/components/organization/billing/` (OrgCurrentPlanCard, OrgPlanChangeModal, OrgAddPaymentMethodModal, OrgPaymentMethodsCard, OrgInvoiceList)

**ファイル削除**:
- `apps/web/src/components/settings/BillingSettings.tsx`
- `apps/web/src/lib/billing.ts`

### Step 5-3: api.ts の課金API定義削除

**ファイル**: `apps/web/src/lib/api.ts`
- `subscriptionApi`オブジェクト全体削除
- `orgBillingApi`オブジェクト全体削除
- 関連型(Subscription, PaymentMethod, Invoice等)削除
- `billingEmail`参照除去

### Step 5-4: 設定画面修正

- `apps/web/src/pages/Settings.tsx` → BillingSettingsのインポート/レンダリング/課金タブ削除
- `apps/web/src/pages/OrganizationSettings.tsx` → OrgBillingSettings関連削除

**検証**: `docker compose exec dev pnpm --filter web test && docker compose exec dev pnpm --filter web build`

---

## Phase 6: Admin フロントエンド（apps/admin）

### Step 6-1: コンポーネント削除

- `apps/admin/src/components/dashboard/RevenueStatsCard.tsx`
- `apps/admin/src/components/users/UserSubscriptionSection.tsx`
- `apps/admin/src/components/organizations/OrganizationSubscriptionSection.tsx`
- `apps/admin/src/pages/MetricsPage.tsx`

### Step 6-2: ページ修正

- `Dashboard.tsx` → RevenueStatsCard使用箇所とrevenueデータ削除
- `UserDetail.tsx` → UserSubscriptionSectionとsubscription削除
- `OrganizationDetail.tsx` → OrganizationSubscriptionSectionとsubscription/billingEmail/paymentCustomerId削除
- `UserStatsCard.tsx` → byPlan表示削除
- `OrgStatsCard.tsx` → byPlan表示削除

### Step 6-3: ルーティング修正

- MetricsPageへのルートとサイドバーの「メトリクス」リンク削除

### Step 6-4: インデックス修正

- 各コンポーネントディレクトリの`index.ts`から削除コンポーネントのエクスポート除去

**検証**: `docker compose exec dev pnpm --filter admin test && docker compose exec dev pnpm --filter admin build`

---

## Phase 7: 環境変数・設定クリーンアップ + 最終検証

### Step 7-1: 環境変数ファイル

- `.env.example`: PAYMENT_GATEWAY/STRIPE_*/VITE_PAYMENT_GATEWAY/VITE_STRIPE_* 削除
- `docker/docker-compose.yml`(該当あれば): STRIPE関連環境変数削除

### Step 7-2: 全体テスト・ビルド検証

```bash
docker compose exec dev pnpm test
docker compose exec dev pnpm build
docker compose exec dev pnpm lint
```

### Step 7-3: Seedデータ投入確認

```bash
docker compose exec dev pnpm --filter @agentest/db prisma db seed
```

### Step 7-4: 残留チェック

コードベース内に以下の課金文脈での実参照がないことを確認:
- `Stripe`, `stripe`
- `subscription`（課金文脈）
- `invoice`, `PaymentMethod`, `PaymentEvent`
- `billingEmail`, `paymentCustomerId`
- `UserPlan`, `OrganizationPlan`, `SubscriptionPlan`
- `PLAN_LIMITS`, `PLAN_PRICING`

---

## テスト戦略サマリ

| 区分 | ファイル数 | フェーズ |
|------|----------|---------|
| テスト削除（API ユニット） | 22 | Phase 2-1 |
| テスト削除（API 統合） | 4 | Phase 2-1 |
| テスト削除（Jobs） | 7 | Phase 4-1 |
| テスト削除（Web） | 1 | Phase 5-1 |
| テスト修正（API） | 12 | Phase 3 |
| テスト修正（Jobs） | 2 | Phase 4-2 |
| テスト修正（Web） | 1 | Phase 5-1 |
| **テスト新規作成** | **1** | Phase 3-1（project.service.org-check.test.ts） |

## 成功基準

- [x] `pnpm test` 全パッケージ通過
- [x] `pnpm build` 全パッケージ通過
- [x] `pnpm lint` エラーなし
- [x] Prismaスキーマに課金関連モデル・enumなし
- [x] 課金文脈でのStripe/subscription/invoice/plan参照なし
- [x] Seedデータ正常投入
- [x] 開発サーバー正常起動
