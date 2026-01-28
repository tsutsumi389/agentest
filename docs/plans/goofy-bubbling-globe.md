# Phase 6: 組織課金フロントエンド実装計画

## 概要

組織向けサブスクリプション（TEAMプラン）のフロントエンド実装。
既存の個人向け課金コンポーネント（`apps/web/src/components/billing/`）のパターンを踏襲する。

## 参照ファイル

- `apps/web/src/components/billing/CurrentPlanCard.tsx` - 個人プラン表示の参考
- `apps/web/src/components/billing/PlanChangeModal.tsx` - プラン変更モーダルの参考
- `apps/web/src/components/billing/PaymentMethodsCard.tsx` - 支払い方法管理の参考
- `apps/web/src/components/billing/AddPaymentMethodModal.tsx` - Stripe Elements統合の参考
- `apps/web/src/pages/OrganizationSettings.tsx` - タブ追加先
- `apps/web/src/lib/api.ts` - API関数追加先

---

## 実装タスク

### 6.1 API関数追加

**ファイル**: `apps/web/src/lib/api.ts`（末尾に追加）

```typescript
// ============================================
// 組織課金API
// ============================================

/** 組織プラン */
export type OrgPlan = 'TEAM' | 'ENTERPRISE';

/** 組織サブスクリプション */
export interface OrgSubscription {
  id: string;
  organizationId: string;
  plan: OrgPlan;
  billingCycle: BillingCycle;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  quantity: number;  // メンバー数
}

/** 組織請求書 */
export interface OrgInvoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  pdfUrl: string | null;
  createdAt: string;
}

/** 組織サブスクリプション作成リクエスト */
export interface CreateOrgSubscriptionRequest {
  billingCycle: BillingCycle;
  paymentMethodId: string;
}

/** 組織プラン料金計算結果 */
export interface OrgPlanCalculation {
  plan: OrgPlan;
  billingCycle: BillingCycle;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  currency: string;
  effectiveDate: string;
}

export const orgBillingApi = {
  // サブスクリプション
  getSubscription: (orgId: string) =>
    api.get<{ subscription: OrgSubscription | null }>(`/api/organizations/${orgId}/subscription`),
  createSubscription: (orgId: string, data: CreateOrgSubscriptionRequest) =>
    api.post<{ subscription: OrgSubscription }>(`/api/organizations/${orgId}/subscription`, data),
  updateSubscription: (orgId: string, data: { billingCycle: BillingCycle }) =>
    api.put<{ subscription: OrgSubscription }>(`/api/organizations/${orgId}/subscription`, data),
  cancelSubscription: (orgId: string) =>
    api.delete<{ subscription: OrgSubscription }>(`/api/organizations/${orgId}/subscription`),
  reactivateSubscription: (orgId: string) =>
    api.post<{ subscription: OrgSubscription }>(`/api/organizations/${orgId}/subscription/reactivate`),
  calculatePlanChange: (orgId: string, billingCycle: BillingCycle) =>
    api.get<{ calculation: OrgPlanCalculation }>(
      `/api/organizations/${orgId}/subscription/calculate?billingCycle=${billingCycle}`
    ),

  // 支払い方法
  getPaymentMethods: (orgId: string) =>
    api.get<{ paymentMethods: PaymentMethod[] }>(`/api/organizations/${orgId}/payment-methods`),
  addPaymentMethod: (orgId: string, paymentMethodId: string) =>
    api.post<{ paymentMethod: PaymentMethod }>(`/api/organizations/${orgId}/payment-methods`, { paymentMethodId }),
  deletePaymentMethod: (orgId: string, paymentMethodId: string) =>
    api.delete<void>(`/api/organizations/${orgId}/payment-methods/${paymentMethodId}`),
  setDefaultPaymentMethod: (orgId: string, paymentMethodId: string) =>
    api.put<{ paymentMethod: PaymentMethod }>(
      `/api/organizations/${orgId}/payment-methods/${paymentMethodId}/default`
    ),
  createSetupIntent: (orgId: string) =>
    api.post<{ setupIntent: { clientSecret: string } }>(
      `/api/organizations/${orgId}/payment-methods/setup-intent`
    ),

  // 請求書
  getInvoices: (orgId: string, params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const queryString = query.toString();
    return api.get<{ invoices: OrgInvoice[]; total: number; page: number; limit: number; totalPages: number }>(
      `/api/organizations/${orgId}/invoices${queryString ? `?${queryString}` : ''}`
    );
  },
};
```

---

### 6.2 組織課金コンポーネント作成

**新規ディレクトリ**: `apps/web/src/components/organization/billing/`

#### 6.2.1 OrgCurrentPlanCard.tsx

現在のプラン表示カード:
- FREEプラン（未契約）状態 → アップグレードボタン
- TEAMプラン契約中 → プラン詳細表示
  - メンバー数 × 単価 = 月額/年額
  - 次回更新日
  - キャンセルボタン
- キャンセル予定状態 → 再開ボタン

参考: `apps/web/src/components/billing/CurrentPlanCard.tsx`

#### 6.2.2 OrgPlanChangeModal.tsx

TEAMプラン契約モーダル（3ステップウィザード）:
1. **Step 1**: 請求サイクル選択（月額¥1,200/user、年額¥12,000/user）
2. **Step 2**: 支払い方法選択（既存 or 新規追加）
3. **Step 3**: 確認・契約実行

参考: `apps/web/src/components/billing/PlanChangeModal.tsx`

#### 6.2.3 OrgPaymentMethodsCard.tsx

支払い方法管理カード:
- 登録済みカード一覧
- デフォルト設定
- カード削除
- 新規追加ボタン

参考: `apps/web/src/components/billing/PaymentMethodsCard.tsx`

#### 6.2.4 OrgAddPaymentMethodModal.tsx

Stripe Elements による支払い方法追加:
- モック環境: テストカード選択
- 本番環境: Stripe PaymentElement
- SetupIntent フロー使用

参考: `apps/web/src/components/billing/AddPaymentMethodModal.tsx`

#### 6.2.5 OrgInvoiceList.tsx

請求履歴テーブル:
- 請求日、金額、ステータス、PDF DLリンク
- ページネーション

#### 6.2.6 OrgBillingSettings.tsx

課金タブのコンテナコンポーネント:
```tsx
<div className="space-y-6">
  <OrgCurrentPlanCard
    organization={organization}
    subscription={subscription}
    onUpgrade={() => setShowPlanModal(true)}
    onCancel={handleCancel}
    onReactivate={handleReactivate}
  />
  <OrgPaymentMethodsCard
    organizationId={organizationId}
    paymentMethods={paymentMethods}
    onAdd={() => setShowAddPaymentModal(true)}
    onDelete={handleDeletePaymentMethod}
    onSetDefault={handleSetDefaultPaymentMethod}
  />
  <OrgInvoiceList organizationId={organizationId} />
</div>
```

---

### 6.3 OrganizationSettings ページ更新

**ファイル**: `apps/web/src/pages/OrganizationSettings.tsx`

#### 変更内容

1. `SettingsTab` 型に `'billing'` を追加:
```typescript
type SettingsTab = 'general' | 'members' | 'invitations' | 'audit-logs' | 'billing' | 'danger';
```

2. `tabs` 配列に課金タブを追加（OWNER/ADMINのみ表示）:
```typescript
{ id: 'billing' as const, label: '課金', icon: CreditCard, roles: ['OWNER', 'ADMIN'] }
```

3. `billing` タブ選択時の表示:
```tsx
{tab === 'billing' && (
  <OrgBillingSettings organizationId={organization.id} />
)}
```

---

## ファイル一覧

| ファイル | 操作 |
|---------|------|
| `apps/web/src/lib/api.ts` | 編集 |
| `apps/web/src/components/organization/billing/OrgCurrentPlanCard.tsx` | 新規 |
| `apps/web/src/components/organization/billing/OrgPlanChangeModal.tsx` | 新規 |
| `apps/web/src/components/organization/billing/OrgPaymentMethodsCard.tsx` | 新規 |
| `apps/web/src/components/organization/billing/OrgAddPaymentMethodModal.tsx` | 新規 |
| `apps/web/src/components/organization/billing/OrgInvoiceList.tsx` | 新規 |
| `apps/web/src/components/organization/billing/OrgBillingSettings.tsx` | 新規 |
| `apps/web/src/components/organization/billing/index.ts` | 新規 |
| `apps/web/src/pages/OrganizationSettings.tsx` | 編集 |

---

## 実装順序

1. **API関数追加** (`api.ts`)
2. **基盤コンポーネント**
   - `OrgAddPaymentMethodModal.tsx`
   - `OrgPaymentMethodsCard.tsx`
3. **プラン関連コンポーネント**
   - `OrgCurrentPlanCard.tsx`
   - `OrgPlanChangeModal.tsx`
4. **請求履歴コンポーネント**
   - `OrgInvoiceList.tsx`
5. **統合コンポーネント**
   - `OrgBillingSettings.tsx`
   - `index.ts`
6. **ページ統合** (`OrganizationSettings.tsx`)

---

## 検証方法

1. **ビルド確認**: `docker compose exec dev pnpm --filter @agentest/web build`
2. **Lint確認**: `docker compose exec dev pnpm --filter @agentest/web lint`
3. **動作確認**:
   - 組織設定ページで「課金」タブが表示される
   - TEAMプラン契約フローが動作する
   - 支払い方法の追加・削除・デフォルト設定が動作する
   - 請求履歴が表示される

---

## 注意事項

- 既存の個人向けコンポーネントのパターンを踏襲
- Stripe Elements のダークテーマ設定を統一
- `VITE_PAYMENT_GATEWAY` 環境変数でモック/本番切り替え
- OWNER/ADMIN のみ課金タブにアクセス可能
