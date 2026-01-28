# Phase 7: テスト実装計画

組織向け課金機能のユニットテスト・結合テストを実装する。

---

## 実装ファイル一覧

| # | ファイル | 種類 | 状態 |
|---|---------|------|------|
| 0 | `apps/api/src/__tests__/integration/test-helpers.ts` | ヘルパー追加 | 既存更新 |
| 1 | `apps/api/src/__tests__/unit/organization-subscription.service.test.ts` | ユニット | 新規 |
| 2 | `apps/api/src/__tests__/unit/organization-payment-method.service.test.ts` | ユニット | 新規 |
| 3 | `apps/api/src/__tests__/unit/organization-billing.controller.test.ts` | ユニット | 新規 |
| 4 | `apps/api/src/__tests__/integration/organization-billing.integration.test.ts` | 結合 | 新規 |
| 5 | `apps/api/src/__tests__/unit/webhook.service.test.ts` | ユニット | 既存更新 |
| 6 | `apps/api/src/__tests__/integration/webhook.integration.test.ts` | 結合 | 既存更新 |

---

## Step 0: テストヘルパー追加

**ファイル**: `apps/api/src/__tests__/integration/test-helpers.ts`

追加するヘルパー関数:

```typescript
/**
 * テスト用組織向け支払い方法を作成
 */
export async function createTestOrgPaymentMethod(
  organizationId: string,
  overrides: Partial<{
    id: string;
    externalId: string;
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.paymentMethod.create({
    data: {
      id,
      organizationId,
      type: 'CARD',
      externalId: overrides.externalId ?? `pm_test_${id.slice(0, 8)}`,
      brand: overrides.brand ?? 'visa',
      last4: overrides.last4 ?? '4242',
      expiryMonth: overrides.expiryMonth ?? 12,
      expiryYear: overrides.expiryYear ?? 2030,
      isDefault: overrides.isDefault ?? false,
    },
  });
}
```

**備考**: `createTestSubscription` は既に `organizationId` 対応済み

---

## Step 1: organization-subscription.service.test.ts

**参照パターン**: `apps/api/src/__tests__/unit/subscription.service.test.ts`

### モック対象

```typescript
const { mockSubscriptionRepo, mockPaymentMethodRepo, mockPaymentGateway, mockPrisma } = vi.hoisted(() => ({
  mockSubscriptionRepo: {
    findByOrganizationId: vi.fn(),
    upsertForOrganization: vi.fn(),
    update: vi.fn(),
  },
  mockPaymentMethodRepo: {
    findById: vi.fn(),
  },
  mockPaymentGateway: {
    createCustomer: vi.fn(),
    createOrgSubscription: vi.fn(),
    updateOrgSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
    updateSubscriptionQuantity: vi.fn(),
    previewProration: vi.fn(),
  },
  mockPrisma: {
    organization: { findUnique: vi.fn(), update: vi.fn() },
    organizationMember: { count: vi.fn(), findFirst: vi.fn() },
  },
}));
```

### テストケース

```
describe('OrganizationSubscriptionService')
├── describe('getSubscription')
│   ├── ✓ 組織のサブスクリプションを取得できる
│   ├── ✓ サブスクリプションが存在しない場合はnullを返す
│   └── ✓ メンバー数(quantity)がレスポンスに含まれる
│
├── describe('createSubscription')
│   ├── ✓ TEAMプラン新規登録に成功する
│   ├── ✓ 既にアクティブなサブスクリプションがある場合はValidationError
│   ├── ✓ PAST_DUEステータスでもサブスクリプション作成を拒否する
│   ├── ✓ 支払い方法が存在しない場合はNotFoundError
│   ├── ✓ 他組織の支払い方法を指定した場合はNotFoundError
│   ├── ✓ 組織にメンバーが存在しない場合はValidationError
│   ├── ✓ 決済顧客IDがない場合は新規作成する（ensureOrgPaymentCustomer）
│   ├── ✓ billingEmailがない場合はOWNERのemailをフォールバック
│   ├── ✓ billingEmailもOWNERもない場合はValidationError
│   └── ✓ 組織のplanがTEAMに更新される
│
├── describe('updateSubscription')
│   ├── ✓ 請求サイクルをMONTHLY→YEARLYに変更できる
│   ├── ✓ サブスクリプションが存在しない場合はNotFoundError
│   └── ✓ externalIdがない場合はValidationError
│
├── describe('cancelSubscription')
│   ├── ✓ キャンセル予約に成功する（cancelAtPeriodEnd=true）
│   ├── ✓ サブスクリプションが存在しない場合はNotFoundError
│   └── ✓ 既にキャンセル予約されている場合はValidationError
│
├── describe('reactivateSubscription')
│   ├── ✓ キャンセル予約の解除に成功する
│   ├── ✓ サブスクリプションが存在しない場合はNotFoundError
│   └── ✓ キャンセル予約されていない場合はValidationError
│
├── describe('syncMemberCount')
│   ├── ✓ Stripeのサブスクリプション数量を更新する
│   ├── ✓ サブスクリプションがない場合は何もしない
│   └── ✓ externalIdがない場合は何もしない
│
└── describe('calculatePlanChange')
    ├── ✓ TEAMプランのMONTHLY料金を計算する
    ├── ✓ TEAMプランのYEARLY料金を計算する
    └── ✓ メンバー数に応じた合計金額を計算する
```

---

## Step 2: organization-payment-method.service.test.ts

**参照パターン**: `apps/api/src/__tests__/unit/payment-method.service.test.ts`

### テストケース

```
describe('OrganizationPaymentMethodService')
├── describe('createSetupIntent')
│   ├── ✓ SetupIntentを作成しclientSecretを返す
│   ├── ✓ 組織が存在しない場合はNotFoundError
│   └── ✓ 決済顧客IDがない場合は新規作成する
│
├── describe('getPaymentMethods')
│   ├── ✓ 組織の支払い方法一覧を取得できる
│   └── ✓ 支払い方法がない場合は空配列を返す
│
├── describe('addPaymentMethod')
│   ├── ✓ 支払い方法を追加できる
│   ├── ✓ 最初の支払い方法はデフォルトに設定される
│   ├── ✓ 2番目以降の支払い方法はデフォルトにならない
│   └── ✓ 決済顧客IDがない場合は新規作成してから追加する
│
├── describe('deletePaymentMethod')
│   ├── ✓ 支払い方法を削除できる
│   ├── ✓ 唯一のデフォルト支払い方法は削除できる
│   ├── ✓ 他に支払い方法がある場合デフォルトは削除できない
│   ├── ✓ 支払い方法が存在しない場合はNotFoundError
│   └── ✓ 他組織の支払い方法は削除できない
│
└── describe('setDefaultPaymentMethod')
    ├── ✓ デフォルト支払い方法を設定できる
    ├── ✓ 既にデフォルトの場合は何もしない
    ├── ✓ 支払い方法が存在しない場合はNotFoundError
    └── ✓ 他組織の支払い方法は設定できない
```

---

## Step 3: organization-billing.controller.test.ts

**参照パターン**: `apps/api/src/__tests__/unit/subscription.controller.test.ts`

### モック対象

```typescript
vi.mock('../../services/organization-subscription.service.js');
vi.mock('../../services/organization-payment-method.service.js');
vi.mock('../../services/organization-invoice.service.js');
```

### テストケース

```
describe('OrganizationBillingController')
├── describe('Subscription エンドポイント')
│   ├── getSubscription: サービス呼び出し・エラーハンドリング
│   ├── createSubscription: リクエストバリデーション・201ステータス
│   ├── updateSubscription: バリデーション・正常系
│   ├── cancelSubscription: 正常系
│   ├── reactivateSubscription: 正常系
│   └── calculatePlanChange: クエリパラメータバリデーション
│
├── describe('PaymentMethod エンドポイント')
│   ├── getPaymentMethods: 一覧取得
│   ├── addPaymentMethod: トークンバリデーション・201ステータス
│   ├── deletePaymentMethod: 204ステータス
│   ├── setDefaultPaymentMethod: 正常系
│   └── createSetupIntent: SetupIntent作成
│
└── describe('Invoice エンドポイント')
    └── getInvoices: ページネーションパラメータ処理
```

---

## Step 4: organization-billing.integration.test.ts

**参照パターン**: `apps/api/src/__tests__/integration/billing.integration.test.ts`

### セットアップ

```typescript
beforeAll(async () => {
  mockGateway = new MockGateway();
  setPaymentGateway(mockGateway);
  const { createApp } = await import('../../app.js');
  app = createApp();
});

beforeEach(async () => {
  await cleanupTestData();
  mockGateway.reset();
  clearTestAuth();

  // テストユーザー・組織作成
  testUser = await createTestUser({ email: 'org-billing-test@example.com' });
  testOrg = await createTestOrganization(testUser.id, { name: 'Test Org' });
});
```

### 認証モック

組織ロールチェック用に `requireOrgRole` をモック:

```typescript
vi.mock('@agentest/auth', () => ({
  requireAuth: () => (req, _res, next) => { /* ... */ },
  requireOrgRole: (roles) => (req, _res, next) => {
    // テスト用: 常に通過させるか、mockOrgRole で制御
    next();
  },
}));
```

### テストシナリオ

```
describe('Organization Billing API Integration Tests')
├── GET /api/organizations/:orgId/subscription
│   ├── ✓ サブスクリプションがない場合はnullを返す
│   ├── ✓ TEAMプランのサブスクリプションを取得できる
│   ├── ✓ 未認証の場合は401エラー
│   └── ✓ MEMBERロールの場合は403エラー
│
├── POST /api/organizations/:orgId/subscription
│   ├── ✓ TEAMプラン契約開始に成功する
│   ├── ✓ 年額プランで契約開始に成功する
│   ├── ✓ メンバー数がquantityに反映される
│   └── ✓ 支払い方法がない場合は404エラー
│
├── PUT /api/organizations/:orgId/subscription
│   └── ✓ 請求サイクル変更
│
├── DELETE /api/organizations/:orgId/subscription
│   ├── ✓ キャンセル予約成功
│   └── ✓ 既にキャンセル済みの場合は400エラー
│
├── POST /api/organizations/:orgId/subscription/reactivate
│   └── ✓ キャンセル予約解除成功
│
├── Payment Methods
│   ├── GET: 一覧取得
│   ├── POST: 追加（最初はデフォルト）
│   ├── DELETE: 削除
│   ├── PUT /:pmId/default: デフォルト設定
│   └── POST /setup-intent: SetupIntent作成
│
├── GET /api/organizations/:orgId/invoices
│   └── ✓ 請求書一覧取得・ページネーション
│
└── E2E: 組織課金フロー
    └── ✓ 組織作成→支払い方法登録→TEAM契約→メンバー追加→数量同期→キャンセル
```

---

## Step 5: webhook.service.test.ts 更新

**追加するテストケース** (既存ファイル末尾に追加):

```
describe('WebhookService - 組織サブスクリプション')
├── describe('handleSubscriptionCreated - organization')
│   ├── ✓ metadataにorganizationIdがある場合は組織用として処理
│   ├── ✓ upsertForOrganization が呼ばれる
│   └── ✓ organizationIdとuserId両方ある場合はorganizationIdを優先
│
├── describe('handleSubscriptionUpdated - organization')
│   └── ✓ 組織サブスクリプションの情報をDBに同期
│
└── describe('handleSubscriptionDeleted - organization')
    ├── ✓ 組織サブスクリプションをCANCELEDにする
    └── ✓ organizationIdがある場合はUser.plan更新をスキップ
```

### モック追加

```typescript
mockSubscriptionRepo: {
  // 既存
  findByUserId: vi.fn(),
  // 追加
  findByOrganizationId: vi.fn(),
  upsertForOrganization: vi.fn(),
}
```

---

## Step 6: webhook.integration.test.ts 更新

**追加するテストケース**:

```
describe('Webhook Integration - 組織サブスクリプション')
├── ✓ invoice.paid: 組織サブスクリプションのInvoice作成
├── ✓ customer.subscription.updated: 組織サブスクリプションDB同期
└── ✓ customer.subscription.deleted: CANCELED更新（User.plan変更なし）
```

---

## 実装順序

```
Step 0: テストヘルパー追加 (createTestOrgPaymentMethod)
    ↓
Step 1-3: ユニットテスト（並行実装可能）
    ├── organization-subscription.service.test.ts
    ├── organization-payment-method.service.test.ts
    └── organization-billing.controller.test.ts
    ↓
Step 4: 結合テスト
    └── organization-billing.integration.test.ts
    ↓
Step 5-6: 既存テスト更新（並行実装可能）
    ├── webhook.service.test.ts
    └── webhook.integration.test.ts
```

---

## 検証方法

```bash
# 全テスト実行
docker compose exec dev pnpm test

# 個別テスト実行
docker compose exec dev pnpm test organization-subscription
docker compose exec dev pnpm test organization-payment-method
docker compose exec dev pnpm test organization-billing
docker compose exec dev pnpm test webhook

# カバレッジ確認
docker compose exec dev pnpm test --coverage
```

---

## 主要ファイルパス

- **テスト対象サービス**:
  - `apps/api/src/services/organization-subscription.service.ts`
  - `apps/api/src/services/organization-payment-method.service.ts`
  - `apps/api/src/services/organization-invoice.service.ts`
  - `apps/api/src/controllers/organization-billing.controller.ts`
  - `apps/api/src/services/webhook.service.ts`

- **参照パターン**:
  - `apps/api/src/__tests__/unit/subscription.service.test.ts`
  - `apps/api/src/__tests__/unit/payment-method.service.test.ts`
  - `apps/api/src/__tests__/integration/billing.integration.test.ts`
  - `apps/api/src/__tests__/unit/webhook.service.test.ts`

- **テストヘルパー**:
  - `apps/api/src/__tests__/integration/test-helpers.ts`
