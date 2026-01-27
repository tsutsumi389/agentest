# ORG-006: 組織プラン選択 - 実装計画

## 概要

組織のOWNER/ADMINがTEAMプランの契約・変更・キャンセルを行う機能。
ENTERPRISEプランは初期リリースでは提供しない（将来対応）。

既存の個人プラン課金システム（FREE/PRO）のパターンを踏襲し、組織向けに拡張する。

---

## Phase 1: スキーマ・共通設定

### 1.1 Prisma スキーマ変更

**ファイル**: `packages/db/prisma/schema.prisma`

- `Organization`モデルに `paymentCustomerId` を追加（Stripe顧客IDの保持）
  ```prisma
  paymentCustomerId String? @unique @map("payment_customer_id") @db.VarChar(255)
  ```
- マイグレーション生成・適用

### 1.2 組織プラン料金設定

**ファイル**: `packages/shared/src/config/plan-pricing.ts`

- `OrgPlanPricing` インターフェース定義（ユーザー単価、Stripe Price ID、機能一覧）
- `ORG_PLAN_PRICING` 定数を追加:
  - TEAM: ¥1,200/user/月、¥12,000/user/年
- ヘルパー関数: `calculateOrgYearlySavings`, `getOrgStripePriceId`

### 1.3 環境変数追加

**ファイル**: `apps/api/src/config/env.ts`

- `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_TEAM_YEARLY` を追加

---

## Phase 2: ゲートウェイ層拡張

### 2.1 型定義追加

**ファイル**: `apps/api/src/gateways/payment/types.ts`

- `CreateOrgSubscriptionParams`: customerId, plan('TEAM'), billingCycle, paymentMethodId, quantity(メンバー数)
- `UpdateOrgSubscriptionParams`: billingCycle?, quantity?
- `OrgSubscriptionResult`: SubscriptionResult を拡張し `quantity` フィールド追加

### 2.2 ゲートウェイインターフェース拡張

**ファイル**: `apps/api/src/gateways/payment/payment-gateway.interface.ts`

- `createOrgSubscription(params)` 追加
- `updateOrgSubscription(subscriptionId, params)` 追加
- `updateSubscriptionQuantity(subscriptionId, quantity)` 追加

### 2.3 StripeGateway 実装

**ファイル**: `apps/api/src/gateways/payment/stripe.gateway.ts`

- `resolveOrgPriceId(plan, cycle)` 追加（環境変数からPrice ID解決）
- 組織サブスクリプション作成: `quantity` パラメータ付き、metadata に `organizationId` を含める
- 数量更新: `proration_behavior: 'create_prorations'`（追加時は即時課金）

### 2.4 MockGateway 実装

**ファイル**: `apps/api/src/gateways/payment/mock.gateway.ts`

- 上記3メソッドのモック実装

---

## Phase 3: バックエンドサービス・リポジトリ

### 3.1 リポジトリ拡張

**ファイル**: `apps/api/src/repositories/subscription.repository.ts`
- `upsertForOrganization()` メソッド追加（既存の `upsertForUser` パターン踏襲）

**ファイル**: `apps/api/src/repositories/invoice.repository.ts`
- `findBySubscriptionId(subscriptionId, pagination)` メソッド追加

### 3.2 OrganizationSubscriptionService 新規作成

**新規ファイル**: `apps/api/src/services/organization-subscription.service.ts`

| メソッド | 説明 |
|---------|------|
| `getSubscription(orgId)` | 現在のサブスクリプション取得 |
| `createSubscription(orgId, input)` | TEAMプラン新規登録（顧客作成→サブスク作成→DB保存→Organization.plan更新） |
| `updateSubscription(orgId, input)` | 請求サイクル変更 |
| `cancelSubscription(orgId)` | 期間終了時キャンセル（cancelAtPeriodEnd） |
| `reactivateSubscription(orgId)` | キャンセル取り消し |
| `syncMemberCount(orgId)` | メンバー数変更時のStripe数量同期 |
| `calculatePlanChange(orgId, plan, cycle)` | 料金プレビュー |

重要なロジック:
- `ensureOrgPaymentCustomer`: Organization.paymentCustomerIdがなければStripe顧客作成し保存
- `syncMemberCount`: DBの実メンバー数を取得してStripeのquantityを更新（レースコンディション対策）

### 3.3 OrganizationPaymentMethodService 新規作成

**新規ファイル**: `apps/api/src/services/organization-payment-method.service.ts`

- `createSetupIntent(orgId)` / `getPaymentMethods(orgId)` / `addPaymentMethod(orgId, token)` / `deletePaymentMethod(orgId, pmId)` / `setDefaultPaymentMethod(orgId, pmId)`
- 既存の個人向け PaymentMethodService と同じパターン

### 3.4 OrganizationInvoiceService 新規作成

**新規ファイル**: `apps/api/src/services/organization-invoice.service.ts`

- `getInvoices(orgId, pagination)`: サブスクリプションID経由で請求書一覧取得

---

## Phase 4: コントローラー・ルート

### 4.1 OrganizationBillingController 新規作成

**新規ファイル**: `apps/api/src/controllers/organization-billing.controller.ts`

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `GET /:orgId/subscription` | getSubscription | サブスクリプション取得 |
| `POST /:orgId/subscription` | createSubscription | TEAM契約開始 |
| `PUT /:orgId/subscription` | updateSubscription | 請求サイクル変更 |
| `DELETE /:orgId/subscription` | cancelSubscription | キャンセル |
| `POST /:orgId/subscription/reactivate` | reactivateSubscription | キャンセル取消 |
| `GET /:orgId/subscription/calculate` | calculatePlanChange | 料金計算 |
| `GET /:orgId/payment-methods` | getPaymentMethods | 支払い方法一覧 |
| `POST /:orgId/payment-methods` | addPaymentMethod | 支払い方法追加 |
| `DELETE /:orgId/payment-methods/:pmId` | deletePaymentMethod | 支払い方法削除 |
| `PUT /:orgId/payment-methods/:pmId/default` | setDefaultPaymentMethod | デフォルト設定 |
| `POST /:orgId/payment-methods/setup-intent` | createSetupIntent | SetupIntent作成 |
| `GET /:orgId/invoices` | getInvoices | 請求履歴 |

### 4.2 ルート登録

**ファイル**: `apps/api/src/routes/organizations.ts`

- 上記全エンドポイントを `requireOrgRole(['OWNER', 'ADMIN'])` + レートリミッター付きで登録

### 4.3 プラン一覧API拡張

**ファイル**: `apps/api/src/controllers/plans.controller.ts`

- `GET /api/plans/organization` エンドポイント追加（組織プラン情報を返す）

---

## Phase 5: Webhook拡張

**ファイル**: `apps/api/src/services/webhook.service.ts`

- `handleSubscriptionCreated`: metadata に `organizationId` がある場合、`upsertForOrganization` を使用
- `handleSubscriptionDeleted`: `subscription.organizationId` がある場合、Organization のサブスクステータスを更新
- `handleSubscriptionUpdated`: 既存ロジックは汎用的で変更不要（externalIdで検索）
- metadata 型に `organizationId?: string` を追加

**ファイル**: `apps/api/src/services/organization.service.ts`

- 招待承諾後: `OrganizationSubscriptionService.syncMemberCount(orgId)` を呼び出し
- メンバー削除後: `OrganizationSubscriptionService.syncMemberCount(orgId)` を呼び出し

---

## Phase 6: フロントエンド

### 6.1 API関数追加

**ファイル**: `apps/web/src/lib/api.ts`

- `OrgSubscription`, `OrgInvoice` 型定義
- `orgBillingApi` オブジェクト（subscription CRUD、payment-methods CRUD、invoices取得）

### 6.2 組織課金コンポーネント新規作成

**新規ディレクトリ**: `apps/web/src/components/organization/billing/`

| コンポーネント | 説明 |
|---------------|------|
| `OrgCurrentPlanCard.tsx` | 現在のプラン表示（プラン名、メンバー数×単価、次回更新日、アクションボタン） |
| `OrgPlanChangeModal.tsx` | TEAMプラン契約モーダル（請求サイクル選択、料金表示） |
| `OrgPaymentMethodsCard.tsx` | 支払い方法管理（一覧、追加、削除、デフォルト設定） |
| `OrgAddPaymentMethodModal.tsx` | Stripe Elements による支払い方法追加 |
| `OrgInvoiceList.tsx` | 請求履歴テーブル（日付、金額、ステータス、PDF） |
| `OrgBillingSettings.tsx` | 上記を統合する課金タブコンテナ |

### 6.3 組織設定ページにBillingタブ追加

**ファイル**: `apps/web/src/pages/OrganizationSettings.tsx`

- `SettingsTab` に `'billing'` を追加
- タブ一覧に「課金」タブ追加（`CreditCard` アイコン、OWNER/ADMINのみ表示）
- `billing` タブ選択時に `OrgBillingSettings` コンポーネントを表示

---

## Phase 7: テスト

### 7.1 ユニットテスト

- `apps/api/src/__tests__/unit/organization-subscription.service.test.ts`（新規）
  - TEAMプラン新規登録、キャンセル・再開、メンバー数同期
- `apps/api/src/__tests__/unit/organization-billing.controller.test.ts`（新規）
  - 各エンドポイントの正常系・異常系
- `apps/api/src/__tests__/unit/organization-payment-method.service.test.ts`（新規）

### 7.2 結合テスト

- `apps/api/src/__tests__/integration/organization-billing.integration.test.ts`（新規）
  - 組織作成→支払い方法登録→TEAM契約→メンバー追加（数量同期確認）→キャンセル→Webhook処理

### 7.3 既存テスト更新

- Webhookテストに組織サブスクリプションイベントのケース追加

---

## 実装順序（依存関係順）

```
Phase 1 (スキーマ・設定)
  ↓
Phase 2 (ゲートウェイ層)
  ↓
Phase 3 (サービス・リポジトリ)
  ↓
Phase 4 (コントローラー・ルート) ← Phase 5 (Webhook) は並行可
  ↓
Phase 6 (フロントエンド)
  ↓
Phase 7 (テスト) ※各Phase完了後に段階的に実施
```

---

## 設計上の注意点

1. **Organization に「無料」プランがない**: サブスクリプションキャンセル後もOrganization.planはTEAMのまま維持し、subscription.status（CANCELED）で有料機能のアクセスを制御する
2. **メンバー数量の同期**: レースコンディション対策のため、`syncMemberCount` は常にDBの実メンバー数をカウントして更新（差分計算はしない）
3. **メンバー削除時の課金**: ビジネスルールに従い、削減分は次回更新時に反映（Stripe の `proration_behavior: 'none'` を使用）
4. **ENTERPRISEプランは初期リリース対象外**: スキーマ上はEnum値として存在するが、UIやAPIでは提供しない。将来対応

---

## 検証方法

1. **DB マイグレーション**: `docker compose exec dev pnpm --filter @agentest/db db:migrate:dev` でマイグレーション適用確認
2. **ユニットテスト**: `docker compose exec dev pnpm test` で全テスト通過確認
3. **API動作確認**:
   - `GET /api/plans/organization` でプラン情報取得
   - `POST /api/organizations/:orgId/subscription` でTEAM契約
   - `GET /api/organizations/:orgId/subscription` でサブスク確認
   - `DELETE /api/organizations/:orgId/subscription` でキャンセル
4. **フロントエンド確認**: 組織設定ページの「課金」タブから契約・支払い方法管理・請求履歴が操作可能なこと
5. **Webhook**: Stripe CLI（`stripe listen --forward-to`）でWebhookイベントの処理確認
