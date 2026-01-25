/**
 * 支払い方法追加モーダル
 * モック環境ではテストフォーム、本番環境ではStripe Elementsを使用
 */

import { useState } from 'react';
import { X, Loader2, CreditCard, Info } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { ApiError, paymentMethodsApi, type PaymentMethod } from '../../lib/api';

interface AddPaymentMethodModalProps {
  onClose: () => void;
  onComplete: (paymentMethod: PaymentMethod) => void;
}

// 決済ゲートウェイの設定（環境変数で切り替え）
const isProduction = import.meta.env.VITE_PAYMENT_GATEWAY === 'stripe';

export function AddPaymentMethodModal({ onClose, onComplete }: AddPaymentMethodModalProps) {
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 支払い方法を追加
  const handleSubmit = async (token: string) => {
    if (!user?.id) return;

    setIsSubmitting(true);
    try {
      const response = await paymentMethodsApi.add(user.id, token);
      onComplete(response.paymentMethod);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('支払い方法の追加に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* モーダル */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">支払い方法を追加</h3>
          <button
            onClick={onClose}
            className="text-foreground-subtle hover:text-foreground"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {isProduction ? (
            // 本番環境: Stripe Elements（将来実装）
            <StripeCardForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
          ) : (
            // モック環境: テストフォーム
            <MockPaymentForm
              onSubmit={handleSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * モック用支払いフォーム
 * テスト環境で使用。実際のカード情報は入力不要。
 */
function MockPaymentForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (token: string) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  // テストカードの選択肢
  const testCards = [
    { brand: 'visa', last4: '4242', label: 'Visa 4242' },
    { brand: 'mastercard', last4: '5555', label: 'Mastercard 5555' },
    { brand: 'amex', last4: '0005', label: 'American Express 0005' },
  ];

  const [selectedCard, setSelectedCard] = useState(testCards[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // モック用トークン（ブランドと下4桁を含む）
    onSubmit(`mock_token_${selectedCard.brand}_${selectedCard.last4}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* テスト環境説明 */}
      <div className="flex items-start gap-3 p-3 bg-info-subtle border border-info rounded-lg">
        <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-info">テスト環境</p>
          <p className="text-foreground-muted mt-1">
            実際のカード情報は不要です。テストカードを選択してください。
          </p>
        </div>
      </div>

      {/* テストカード選択 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          テストカードを選択
        </label>
        <div className="space-y-2">
          {testCards.map((card) => (
            <button
              key={card.last4}
              type="button"
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                selectedCard.last4 === card.last4
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border hover:border-accent-subtle'
              }`}
              onClick={() => setSelectedCard(card)}
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-foreground-muted" />
                <span className="font-medium text-foreground">{card.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          追加
        </button>
      </div>
    </form>
  );
}

/**
 * Stripe Elementsフォーム（将来実装）
 * 本番環境で使用。Stripeアカウント設定後に実装。
 */
function StripeCardForm(_props: {
  onSubmit: (token: string) => void;
  isSubmitting: boolean;
}) {
  // TODO: Stripe.jsの読み込みとElements初期化
  // import { loadStripe } from '@stripe/stripe-js';
  // import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

  return (
    <div className="space-y-4">
      <div className="p-4 bg-warning-subtle border border-warning rounded-lg">
        <p className="text-sm text-warning font-medium">準備中</p>
        <p className="text-sm text-foreground-muted mt-1">
          本番環境のカード登録機能は現在準備中です。
        </p>
      </div>

      {/* プレースホルダー */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            カード番号
          </label>
          <input
            type="text"
            placeholder="4242 4242 4242 4242"
            className="input w-full"
            disabled
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              有効期限
            </label>
            <input
              type="text"
              placeholder="MM/YY"
              className="input w-full"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              CVC
            </label>
            <input
              type="text"
              placeholder="123"
              className="input w-full"
              disabled
            />
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary w-full"
        disabled
      >
        カードを追加
      </button>
    </div>
  );
}
