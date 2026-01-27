# Stripe Elements フロントエンド実装計画

## 概要

`AddPaymentMethodModal.tsx` のプレースホルダー `StripeCardForm` を、実際の Stripe Elements（`@stripe/react-stripe-js`）を使ったカード入力フォームに置き換える。SetupIntent フローでカード情報を安全に収集する。

## 現状

- `@stripe/react-stripe-js` (v5.5.0) と `@stripe/stripe-js` (v8.6.4) は **既にインストール済み**
- `VITE_STRIPE_PUBLISHABLE_KEY` 環境変数は定義済み
- バックエンド `POST /api/users/:userId/payment-methods/setup-intent` は実装済み（clientSecret を返す）
- バックエンド `POST /api/users/:userId/payment-methods` は token（= Stripe PaymentMethod ID）を受け取る
- フロントエンドの `paymentMethodsApi` に setupIntent メソッドが**未実装**
- `StripeCardForm` コンポーネントはプレースホルダー状態

## フロー

```
1. モーダル表示時に setupIntent API を呼び出し → clientSecret 取得
2. Elements Provider に clientSecret を渡して初期化
3. ユーザーがカード情報を入力（PaymentElement）
4. stripe.confirmSetup() でカード登録を確定
5. 結果の paymentMethod.id を add API に送信
6. バックエンドで Stripe PaymentMethod をアタッチ＆DB保存
```

## 変更対象ファイル

### 1. `apps/web/src/lib/api.ts`
- `paymentMethodsApi` に `setupIntent` メソッドを追加

```typescript
// SetupIntent作成
setupIntent: (userId: string) =>
  api.post<{ setupIntent: { clientSecret: string } }>(
    `/api/users/${userId}/payment-methods/setup-intent`
  ),
```

### 2. `apps/web/src/lib/stripe.ts` (新規)
- `loadStripe` でStripeインスタンスをシングルトン初期化
- publishable key は `import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY` から取得

```typescript
import { loadStripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
export const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
```

### 3. `apps/web/src/components/billing/AddPaymentMethodModal.tsx`
- `StripeCardForm` を実際の Stripe Elements 実装に置き換え
- フロー:
  1. マウント時に `setupIntent` API を呼び出し clientSecret を取得
  2. `<Elements>` プロバイダーで `stripe` と `clientSecret` を渡す
  3. `<PaymentElement>` でカード入力 UI を表示
  4. 送信時に `stripe.confirmSetup()` を呼び出し
  5. 成功したら `setupIntent.payment_method` を取得し、`paymentMethodsApi.add()` で登録
- Elements の appearance は既存のダークテーマ（GitHub Dark）に合わせたカスタムテーマを設定
- エラーハンドリング: Stripe の返すエラーメッセージをトーストで表示

### 4. カード情報入力UIの構成

```
StripeCardForm
├── clientSecret 取得中 → ローディングスピナー
├── clientSecret 取得失敗 → エラー表示 + リトライボタン
└── clientSecret 取得済み
    └── <Elements stripe={stripePromise} options={...}>
        └── <StripeCardFormInner>
            ├── <PaymentElement /> （Stripe管理のカード入力フォーム）
            ├── キャンセルボタン
            └── 追加ボタン（submitting中はローディング表示）
```

## Stripe Elements Appearance 設定

既存の Tailwind テーマに合わせたダークテーマ:

```typescript
const appearance: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#58a6ff',      // accent
    colorBackground: '#0d1117',    // background
    colorText: '#e6edf3',          // foreground
    colorDanger: '#f85149',        // danger
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '8px',
  },
  rules: {
    '.Input': {
      backgroundColor: '#161b22',  // background-secondary
      borderColor: '#30363d',      // border
    },
    '.Input:focus': {
      borderColor: '#58a6ff',      // accent
    },
  },
};
```

## 検証方法

1. `.env` で `VITE_PAYMENT_GATEWAY=stripe` かつ `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx` を設定
2. ブラウザで `/settings` → Billing タブ → 「追加」ボタンをクリック
3. Stripe Elements のカード入力フォームが表示されることを確認
4. テストカード `4242 4242 4242 4242` で送信し、支払い方法が登録されることを確認
5. `VITE_PAYMENT_GATEWAY=mock` の場合は従来のモックフォームが表示されることを確認
