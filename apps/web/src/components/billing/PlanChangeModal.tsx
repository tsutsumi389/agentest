/**
 * プラン変更モーダル
 * ステップ形式でプラン選択→支払い選択→確認を行う
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CreditCard, Check, ChevronRight, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import {
  ApiError,
  plansApi,
  subscriptionApi,
  paymentMethodsApi,
  type PlanInfo,
  type PaymentMethod,
  type Subscription,
  type BillingCycle,
  type PlanChangeCalculation,
} from '../../lib/api';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { formatExpiry } from './PaymentMethodsCard';

interface PlanChangeModalProps {
  onClose: () => void;
  onComplete: (subscription: Subscription) => void;
}

type Step = 'billing-cycle' | 'payment-method' | 'confirm';

/**
 * 金額をフォーマット（日本円）
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(price);
}

export function PlanChangeModal({ onClose, onComplete }: PlanChangeModalProps) {
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>('billing-cycle');
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  // 選択状態
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<PlanChangeCalculation | null>(null);

  // プラン一覧取得
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await plansApi.list();
        setPlans(response.plans);
      } catch (error) {
        console.error('プラン取得エラー:', error);
        toast.error('プラン情報の取得に失敗しました');
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  // 支払い方法一覧取得
  const fetchPaymentMethods = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingPaymentMethods(true);
    try {
      const response = await paymentMethodsApi.list(user.id);
      setPaymentMethods(response.paymentMethods);

      // デフォルトの支払い方法を選択
      const defaultMethod = response.paymentMethods.find((pm) => pm.isDefault);
      if (defaultMethod) {
        setSelectedPaymentMethodId(defaultMethod.id);
      } else if (response.paymentMethods.length > 0) {
        setSelectedPaymentMethodId(response.paymentMethods[0].id);
      }
    } catch (error) {
      console.error('支払い方法取得エラー:', error);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  // 料金計算
  const calculatePrice = useCallback(async () => {
    setIsCalculating(true);
    try {
      const response = await plansApi.calculate('PRO', selectedBillingCycle);
      setCalculation(response.calculation);
    } catch (error) {
      console.error('料金計算エラー:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [selectedBillingCycle]);

  // 確認ステップに移動時に料金計算
  useEffect(() => {
    if (step === 'confirm') {
      calculatePrice();
    }
  }, [step, calculatePrice]);

  // PROプラン情報
  const proPlan = plans.find((p) => p.plan === 'PRO');

  // 次のステップへ
  const handleNext = () => {
    if (step === 'billing-cycle') {
      // 支払い方法がない場合は追加モーダルを表示
      if (paymentMethods.length === 0) {
        setShowAddPaymentModal(true);
        return;
      }
      setStep('payment-method');
    } else if (step === 'payment-method') {
      if (!selectedPaymentMethodId) {
        toast.error('支払い方法を選択してください');
        return;
      }
      setStep('confirm');
    }
  };

  // 前のステップへ
  const handleBack = () => {
    if (step === 'payment-method') {
      setStep('billing-cycle');
    } else if (step === 'confirm') {
      setStep('payment-method');
    }
  };

  // サブスクリプション作成
  const handleSubmit = async () => {
    if (!user?.id || !selectedPaymentMethodId) return;

    setIsSubmitting(true);
    try {
      const response = await subscriptionApi.create(user.id, {
        plan: 'PRO',
        billingCycle: selectedBillingCycle,
        paymentMethodId: selectedPaymentMethodId,
      });
      onComplete(response.subscription);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('プランのアップグレードに失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 支払い方法追加完了
  const handleAddPaymentMethodComplete = (newPaymentMethod: PaymentMethod) => {
    setPaymentMethods((prev) => [...prev, newPaymentMethod]);
    setSelectedPaymentMethodId(newPaymentMethod.id);
    setShowAddPaymentModal(false);
    toast.success('支払い方法を追加しました');
    setStep('payment-method');
  };

  const isLoading = isLoadingPlans || isLoadingPaymentMethods;

  return (
    <>
      <div className="fixed inset-0 z-modal flex items-center justify-center">
        {/* オーバーレイ */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* モーダル */}
        <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">PROプランにアップグレード</h3>
            <button
              onClick={onClose}
              className="text-foreground-subtle hover:text-foreground"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-2 py-4 border-b border-border">
            <StepIndicator
              step={1}
              label="プラン選択"
              isActive={step === 'billing-cycle'}
              isComplete={step !== 'billing-cycle'}
            />
            <ChevronRight className="w-4 h-4 text-foreground-subtle" />
            <StepIndicator
              step={2}
              label="支払い方法"
              isActive={step === 'payment-method'}
              isComplete={step === 'confirm'}
            />
            <ChevronRight className="w-4 h-4 text-foreground-subtle" />
            <StepIndicator
              step={3}
              label="確認"
              isActive={step === 'confirm'}
              isComplete={false}
            />
          </div>

          {/* コンテンツ */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
              </div>
            ) : (
              <>
                {/* ステップ1: 請求サイクル選択 */}
                {step === 'billing-cycle' && proPlan && (
                  <BillingCycleStep
                    plan={proPlan}
                    selectedCycle={selectedBillingCycle}
                    onSelectCycle={setSelectedBillingCycle}
                  />
                )}

                {/* ステップ2: 支払い方法選択 */}
                {step === 'payment-method' && (
                  <PaymentMethodStep
                    paymentMethods={paymentMethods}
                    selectedId={selectedPaymentMethodId}
                    onSelectPaymentMethod={setSelectedPaymentMethodId}
                    onAddPaymentMethod={() => setShowAddPaymentModal(true)}
                  />
                )}

                {/* ステップ3: 確認 */}
                {step === 'confirm' && (
                  <ConfirmStep
                    billingCycle={selectedBillingCycle}
                    paymentMethod={paymentMethods.find((pm) => pm.id === selectedPaymentMethodId)}
                    calculation={calculation}
                    isCalculating={isCalculating}
                  />
                )}
              </>
            )}
          </div>

          {/* フッター */}
          <div className="flex justify-between p-4 border-t border-border">
            <button
              className="btn btn-ghost"
              onClick={step === 'billing-cycle' ? onClose : handleBack}
              disabled={isSubmitting}
            >
              {step === 'billing-cycle' ? 'キャンセル' : '戻る'}
            </button>
            {step === 'confirm' ? (
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || isCalculating}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                アップグレードする
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={isLoading}
              >
                次へ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 支払い方法追加モーダル */}
      {showAddPaymentModal && (
        <AddPaymentMethodModal
          onClose={() => setShowAddPaymentModal(false)}
          onComplete={handleAddPaymentMethodComplete}
        />
      )}
    </>
  );
}

/**
 * ステップインジケーター
 */
function StepIndicator({
  step,
  label,
  isActive,
  isComplete,
}: {
  step: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          isActive
            ? 'bg-accent text-white'
            : isComplete
            ? 'bg-success text-white'
            : 'bg-background-tertiary text-foreground-muted'
        }`}
      >
        {isComplete ? <Check className="w-3 h-3" /> : step}
      </div>
      <span
        className={`text-sm ${
          isActive ? 'text-foreground font-medium' : 'text-foreground-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * 請求サイクル選択ステップ
 */
function BillingCycleStep({
  plan,
  selectedCycle,
  onSelectCycle,
}: {
  plan: PlanInfo;
  selectedCycle: BillingCycle;
  onSelectCycle: (cycle: BillingCycle) => void;
}) {
  const yearlySavings = plan.monthlyPrice * 12 - plan.yearlyPrice;

  return (
    <div className="space-y-4">
      <p className="text-foreground-muted">請求サイクルを選択してください</p>

      <div className="space-y-3">
        {/* 月額 */}
        <button
          className={`w-full p-4 rounded-lg border text-left transition-colors ${
            selectedCycle === 'MONTHLY'
              ? 'border-accent bg-accent-subtle'
              : 'border-border hover:border-accent-subtle'
          }`}
          onClick={() => onSelectCycle('MONTHLY')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">月額プラン</p>
              <p className="text-sm text-foreground-muted">毎月請求</p>
            </div>
            <p className="text-lg font-bold text-foreground">
              {formatPrice(plan.monthlyPrice)}<span className="text-sm font-normal">/月</span>
            </p>
          </div>
        </button>

        {/* 年額 */}
        <button
          className={`w-full p-4 rounded-lg border text-left transition-colors ${
            selectedCycle === 'YEARLY'
              ? 'border-accent bg-accent-subtle'
              : 'border-border hover:border-accent-subtle'
          }`}
          onClick={() => onSelectCycle('YEARLY')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                年額プラン
                {yearlySavings > 0 && (
                  <span className="ml-2 badge badge-success text-xs">
                    {formatPrice(yearlySavings)} お得
                  </span>
                )}
              </p>
              <p className="text-sm text-foreground-muted">年1回請求</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">
                {formatPrice(plan.yearlyPrice)}<span className="text-sm font-normal">/年</span>
              </p>
              <p className="text-xs text-foreground-muted">
                月あたり {formatPrice(Math.round(plan.yearlyPrice / 12))}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* 機能一覧 */}
      <div className="pt-4 border-t border-border">
        <p className="text-sm font-medium text-foreground mb-3">含まれる機能</p>
        <ul className="space-y-2">
          {plan.features
            .filter((f) => f.included)
            .map((feature, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-foreground-muted">
                <Check className="w-4 h-4 text-success" />
                {feature.name}: {feature.description}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * 支払い方法選択ステップ
 */
function PaymentMethodStep({
  paymentMethods,
  selectedId,
  onSelectPaymentMethod,
  onAddPaymentMethod,
}: {
  paymentMethods: PaymentMethod[];
  selectedId: string | null;
  onSelectPaymentMethod: (id: string) => void;
  onAddPaymentMethod: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-foreground-muted">支払いに使用するカードを選択してください</p>

      <div className="space-y-3">
        {paymentMethods.map((pm) => (
          <button
            key={pm.id}
            className={`w-full p-4 rounded-lg border text-left transition-colors ${
              selectedId === pm.id
                ? 'border-accent bg-accent-subtle'
                : 'border-border hover:border-accent-subtle'
            }`}
            onClick={() => onSelectPaymentMethod(pm.id)}
          >
            <div className="flex items-center gap-4">
              <CreditCard className="w-6 h-6 text-foreground-muted" />
              <div>
                <p className="font-medium text-foreground">
                  {pm.brand?.toUpperCase() || 'CARD'} •••• {pm.last4 || '****'}
                </p>
                <p className="text-sm text-foreground-muted">
                  有効期限: {formatExpiry(pm.expiryMonth, pm.expiryYear)}
                </p>
              </div>
              {pm.isDefault && (
                <span className="badge badge-accent text-xs ml-auto">デフォルト</span>
              )}
            </div>
          </button>
        ))}

        {/* 支払い方法追加 */}
        <button
          className="w-full p-4 rounded-lg border border-dashed border-border text-left hover:border-accent-subtle transition-colors"
          onClick={onAddPaymentMethod}
        >
          <div className="flex items-center gap-4">
            <Plus className="w-6 h-6 text-foreground-muted" />
            <p className="text-foreground-muted">新しい支払い方法を追加</p>
          </div>
        </button>
      </div>
    </div>
  );
}

/**
 * 確認ステップ
 */
function ConfirmStep({
  billingCycle,
  paymentMethod,
  calculation,
  isCalculating,
}: {
  billingCycle: BillingCycle;
  paymentMethod?: PaymentMethod;
  calculation: PlanChangeCalculation | null;
  isCalculating: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-foreground-muted">以下の内容でアップグレードします</p>

      {isCalculating ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* プラン情報 */}
          <div className="p-4 rounded-lg bg-background-secondary">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground-muted">プラン</span>
              <span className="font-medium text-foreground">PRO</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground-muted">請求サイクル</span>
              <span className="font-medium text-foreground">
                {billingCycle === 'YEARLY' ? '年額' : '月額'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-foreground-muted">金額</span>
              <span className="text-lg font-bold text-foreground">
                {calculation ? formatPrice(calculation.price) : '-'}
              </span>
            </div>
          </div>

          {/* 支払い方法 */}
          {paymentMethod && (
            <div className="p-4 rounded-lg bg-background-secondary">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="font-medium text-foreground">
                    {paymentMethod.brand?.toUpperCase() || 'CARD'} •••• {paymentMethod.last4 || '****'}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    このカードで支払います
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 注意事項 */}
          <p className="text-xs text-foreground-subtle">
            「アップグレードする」をクリックすると、選択した支払い方法で即時請求されます。
            サブスクリプションはいつでもキャンセルできます。
          </p>
        </div>
      )}
    </div>
  );
}
