/**
 * 組織向け支払い方法追加モーダル
 * モック環境ではテストフォーム、本番環境ではStripe Elementsを使用
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CreditCard, Info, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from '../../../stores/toast';
import { ApiError, orgBillingApi, type PaymentMethod } from '../../../lib/api';
import { stripePromise } from '../../../lib/stripe';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';

interface OrgAddPaymentMethodModalProps {
  organizationId: string;
  onClose: () => void;
  onComplete: (paymentMethod: PaymentMethod) => void;
}

// 決済ゲートウェイの設定（環境変数で切り替え）
const isStripeGateway = import.meta.env.VITE_PAYMENT_GATEWAY === 'stripe';

// Stripe Elements のダークテーマ設定
const appearance: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#58a6ff',
    colorBackground: '#0d1117',
    colorText: '#e6edf3',
    colorDanger: '#f85149',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '8px',
  },
  rules: {
    '.Input': {
      backgroundColor: '#161b22',
      borderColor: '#30363d',
    },
    '.Input:focus': {
      borderColor: '#58a6ff',
    },
  },
};

export function OrgAddPaymentMethodModal({
  organizationId,
  onClose,
  onComplete,
}: OrgAddPaymentMethodModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 支払い方法を追加
  const handleSubmit = async (paymentMethodId: string) => {
    setIsSubmitting(true);
    try {
      const response = await orgBillingApi.addPaymentMethod(organizationId, paymentMethodId);
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
    <div
      className="fixed inset-0 z-modal flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-payment-method-modal-title"
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* モーダル */}
      <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 id="add-payment-method-modal-title" className="text-lg font-semibold text-foreground">
            支払い方法を追加
          </h3>
          <button
            onClick={onClose}
            className="text-foreground-subtle hover:text-foreground"
            disabled={isSubmitting}
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          {isStripeGateway ? (
            <StripeCardForm
              organizationId={organizationId}
              onSubmit={handleSubmit}
              onCancel={onClose}
              isSubmitting={isSubmitting}
            />
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
  onSubmit: (token: string) => Promise<void>;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // モック用トークン（ブランドと下4桁を含む）
    await onSubmit(`mock_token_${selectedCard.brand}_${selectedCard.last4}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* テスト環境説明 */}
      <div className="flex items-start gap-3 p-3 bg-info-subtle border border-info rounded-lg">
        <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-info">テスト環境</p>
          <p className="text-foreground-muted mt-1">
            実際のカード情報は不要です。テストカードを選択してください。
          </p>
        </div>
      </div>

      {/* テストカード選択 */}
      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium text-foreground">
          テストカードを選択
        </legend>
        <div className="space-y-2" role="radiogroup" aria-label="テストカード選択">
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
              role="radio"
              aria-checked={selectedCard.last4 === card.last4}
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-foreground-muted" aria-hidden="true" />
                <span className="font-medium text-foreground">{card.label}</span>
              </div>
            </button>
          ))}
        </div>
      </fieldset>

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
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          追加
        </button>
      </div>
    </form>
  );
}

/**
 * Stripe Elementsフォーム
 * SetupIntentフローでカード情報を安全に収集する
 */
function StripeCardForm({
  organizationId,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  organizationId: string;
  onSubmit: (token: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SetupIntent の clientSecret を取得
  const fetchSetupIntent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await orgBillingApi.createSetupIntent(organizationId);
      setClientSecret(response.setupIntent.clientSecret);
    } catch (err) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : 'SetupIntentの作成に失敗しました';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    // Stripe 公開キーが未設定なら API を呼ばない
    if (!stripePromise) {
      setLoading(false);
      return;
    }
    fetchSetupIntent();
  }, [fetchSetupIntent]);

  // Stripe 公開キーが未設定の場合（API呼び出し前にチェック）
  if (!stripePromise) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-warning-subtle border border-warning rounded-lg">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-warning">設定エラー</p>
            <p className="text-foreground-muted mt-1">
              Stripeの公開キーが設定されていません。管理者にお問い合わせください。
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  // ローディング中
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" aria-hidden="true" />
        <p className="text-sm text-foreground-muted">カード入力フォームを準備中...</p>
      </div>
    );
  }

  // エラー時
  if (error || !clientSecret) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-danger-subtle border border-danger rounded-lg">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-danger">エラー</p>
            <p className="text-foreground-muted mt-1">
              {error || 'カード入力フォームの初期化に失敗しました'}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={fetchSetupIntent}
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            リトライ
          </button>
        </div>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance,
      }}
    >
      <StripeCardFormInner
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
      />
    </Elements>
  );
}

/**
 * Stripe Elements 内部フォーム
 * Elements Provider 内で useStripe / useElements を使用する
 */
function StripeCardFormInner({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (token: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [elementReady, setElementReady] = useState(false);

  // confirmSetup中 または 親のAPI呼び出し中
  const isProcessing = confirming || isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setConfirming(true);
    try {
      // カード登録を確定
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          // 3Dセキュア等のリダイレクトが必要な場合の戻り先URL
          return_url: `${window.location.origin}/organizations?tab=billing`,
        },
        redirect: 'if_required',
      });

      if (result.error) {
        toast.error(result.error.message || 'カードの登録に失敗しました');
        return;
      }

      // 成功時: setupIntent から paymentMethod ID を取得しバックエンドに送信
      const setupIntent = result.setupIntent;
      if (setupIntent?.payment_method) {
        const paymentMethodId = typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method.id;
        // 親の add API が完了するまで await し、processing 状態を維持する
        await onSubmit(paymentMethodId);
      } else {
        toast.error('支払い方法の情報を取得できませんでした');
      }
    } catch {
      toast.error('カードの登録中にエラーが発生しました');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Stripe PaymentElement */}
      <PaymentElement
        onReady={() => setElementReady(true)}
        options={{
          layout: 'tabs',
        }}
      />

      {/* ボタン */}
      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={isProcessing}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isProcessing || !stripe || !elements || !elementReady}
        >
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          追加
        </button>
      </div>
    </form>
  );
}
