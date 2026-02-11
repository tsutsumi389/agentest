/**
 * 組織向けプラン変更モーダル
 * ステップ形式で請求サイクル選択→支払い方法選択→確認を行う
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CreditCard, Check, ChevronRight, Plus } from 'lucide-react';
import { toast } from '../../../stores/toast';
import {
  ApiError,
  orgBillingApi,
  type PaymentMethod,
  type OrgSubscription,
  type BillingCycle,
  type OrgPlanCalculation,
} from '../../../lib/api';
import {
  TEAM_PLAN_PRICES,
  formatPrice,
  formatCardExpiry,
  calculateYearlySavings,
} from '../../../lib/billing';
import { OrgAddPaymentMethodModal } from './OrgAddPaymentMethodModal';

interface OrgPlanChangeModalProps {
  organizationId: string;
  memberCount: number;
  onClose: () => void;
  onComplete: (subscription: OrgSubscription) => void;
}

type Step = 'billing-cycle' | 'payment-method' | 'confirm';

export function OrgPlanChangeModal({
  organizationId,
  memberCount,
  onClose,
  onComplete,
}: OrgPlanChangeModalProps) {
  const [step, setStep] = useState<Step>('billing-cycle');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  // 選択状態
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<OrgPlanCalculation | null>(null);

  // 支払い方法一覧取得
  const fetchPaymentMethods = useCallback(async () => {
    setIsLoadingPaymentMethods(true);
    try {
      const response = await orgBillingApi.getPaymentMethods(organizationId);
      setPaymentMethods(response.paymentMethods);

      // デフォルトの支払い方法を選択
      const defaultMethod = response.paymentMethods.find((pm) => pm.isDefault);
      if (defaultMethod) {
        setSelectedPaymentMethodId(defaultMethod.id);
      } else if (response.paymentMethods.length > 0) {
        setSelectedPaymentMethodId(response.paymentMethods[0].id);
      }
    } catch {
      // エラー時は空のリストとして扱い、ユーザーに新規追加を促す
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  // 料金計算
  const calculatePrice = useCallback(async () => {
    setIsCalculating(true);
    try {
      const response = await orgBillingApi.calculatePlanChange(organizationId, selectedBillingCycle);
      setCalculation(response.calculation);
    } catch {
      // エラー時はローカル計算にフォールバック
      setCalculation({
        plan: 'TEAM',
        billingCycle: selectedBillingCycle,
        unitPrice: TEAM_PLAN_PRICES[selectedBillingCycle],
        quantity: memberCount,
        totalPrice: TEAM_PLAN_PRICES[selectedBillingCycle] * memberCount,
        currency: 'JPY',
        effectiveDate: new Date().toISOString(),
      });
    } finally {
      setIsCalculating(false);
    }
  }, [organizationId, selectedBillingCycle, memberCount]);

  // 確認ステップに移動時に料金計算
  useEffect(() => {
    if (step === 'confirm') {
      calculatePrice();
    }
  }, [step, calculatePrice]);

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
    if (!selectedPaymentMethodId) return;

    setIsSubmitting(true);
    try {
      const response = await orgBillingApi.createSubscription(organizationId, {
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

  const isLoading = isLoadingPaymentMethods;

  return (
    <>
      <div
        className="fixed inset-0 z-modal flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-change-modal-title"
      >
        {/* オーバーレイ */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* モーダル */}
        <div className="relative bg-background border border-border rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 id="plan-change-modal-title" className="text-lg font-semibold text-foreground">
              TEAMプランにアップグレード
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

          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-2 py-4 border-b border-border">
            <StepIndicator
              step={1}
              label="プラン選択"
              isActive={step === 'billing-cycle'}
              isComplete={step !== 'billing-cycle'}
            />
            <ChevronRight className="w-4 h-4 text-foreground-subtle" aria-hidden="true" />
            <StepIndicator
              step={2}
              label="支払い方法"
              isActive={step === 'payment-method'}
              isComplete={step === 'confirm'}
            />
            <ChevronRight className="w-4 h-4 text-foreground-subtle" aria-hidden="true" />
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
                {step === 'billing-cycle' && (
                  <BillingCycleStep
                    memberCount={memberCount}
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
                    memberCount={memberCount}
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
        <OrgAddPaymentMethodModal
          organizationId={organizationId}
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
        aria-current={isActive ? 'step' : undefined}
      >
        {isComplete ? <Check className="w-3 h-3" aria-hidden="true" /> : step}
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
  memberCount,
  selectedCycle,
  onSelectCycle,
}: {
  memberCount: number;
  selectedCycle: BillingCycle;
  onSelectCycle: (cycle: BillingCycle) => void;
}) {
  const monthlyPrice = TEAM_PLAN_PRICES.MONTHLY * memberCount;
  const yearlyPrice = TEAM_PLAN_PRICES.YEARLY * memberCount;
  // 年額プランの節約額（月額12ヶ月分 - 年額 = 2ヶ月分お得）
  const yearlySavings = calculateYearlySavings(memberCount);

  return (
    <div className="space-y-4">
      <p className="text-foreground-muted">請求サイクルを選択してください</p>

      {/* メンバー数表示 */}
      <div className="p-3 bg-background-secondary rounded-lg">
        <p className="text-sm text-foreground-muted">
          現在のメンバー数: <span className="font-medium text-foreground">{memberCount}人</span>
        </p>
        <p className="text-xs text-foreground-subtle mt-1">
          ※メンバー追加・削除時は自動で数量が調整されます
        </p>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label="請求サイクル選択">
        {/* 月額 */}
        <button
          className={`w-full p-4 rounded-lg border text-left transition-colors ${
            selectedCycle === 'MONTHLY'
              ? 'border-accent bg-accent-subtle'
              : 'border-border hover:border-accent-subtle'
          }`}
          onClick={() => onSelectCycle('MONTHLY')}
          role="radio"
          aria-checked={selectedCycle === 'MONTHLY'}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">月額プラン</p>
              <p className="text-sm text-foreground-muted">毎月請求</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">
                {formatPrice(monthlyPrice)}<span className="text-sm font-normal">/月</span>
              </p>
              <p className="text-xs text-foreground-muted">
                {formatPrice(TEAM_PLAN_PRICES.MONTHLY)}/人
              </p>
            </div>
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
          role="radio"
          aria-checked={selectedCycle === 'YEARLY'}
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
                {formatPrice(yearlyPrice)}<span className="text-sm font-normal">/年</span>
              </p>
              <p className="text-xs text-foreground-muted">
                {formatPrice(TEAM_PLAN_PRICES.YEARLY)}/人
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* 機能一覧 */}
      <div className="pt-4 border-t border-border">
        <p className="text-sm font-medium text-foreground mb-3">含まれる機能</p>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm text-foreground-muted">
            <Check className="w-4 h-4 text-success" aria-hidden="true" />
            組織メンバー数: 無制限
          </li>
          <li className="flex items-center gap-2 text-sm text-foreground-muted">
            <Check className="w-4 h-4 text-success" aria-hidden="true" />
            組織プロジェクト数: 無制限
          </li>
          <li className="flex items-center gap-2 text-sm text-foreground-muted">
            <Check className="w-4 h-4 text-success" aria-hidden="true" />
            高度なアクセス制御
          </li>
          <li className="flex items-center gap-2 text-sm text-foreground-muted">
            <Check className="w-4 h-4 text-success" aria-hidden="true" />
            監査ログ機能
          </li>
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

      <div className="space-y-3" role="radiogroup" aria-label="支払い方法選択">
        {paymentMethods.map((pm) => (
          <button
            key={pm.id}
            className={`w-full p-4 rounded-lg border text-left transition-colors ${
              selectedId === pm.id
                ? 'border-accent bg-accent-subtle'
                : 'border-border hover:border-accent-subtle'
            }`}
            onClick={() => onSelectPaymentMethod(pm.id)}
            role="radio"
            aria-checked={selectedId === pm.id}
          >
            <div className="flex items-center gap-4">
              <CreditCard className="w-6 h-6 text-foreground-muted" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">
                  {pm.brand?.toUpperCase() || 'CARD'} •••• {pm.last4 || '****'}
                </p>
                <p className="text-sm text-foreground-muted">
                  有効期限: {formatCardExpiry(pm.expiryMonth, pm.expiryYear)}
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
            <Plus className="w-6 h-6 text-foreground-muted" aria-hidden="true" />
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
  memberCount,
  paymentMethod,
  calculation,
  isCalculating,
}: {
  billingCycle: BillingCycle;
  memberCount: number;
  paymentMethod?: PaymentMethod;
  calculation: OrgPlanCalculation | null;
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
              <span className="font-medium text-foreground">TEAM</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground-muted">請求サイクル</span>
              <span className="font-medium text-foreground">
                {billingCycle === 'YEARLY' ? '年額' : '月額'}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground-muted">メンバー数</span>
              <span className="font-medium text-foreground">
                {calculation?.quantity || memberCount}人
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground-muted">単価</span>
              <span className="font-medium text-foreground">
                {calculation ? formatPrice(calculation.unitPrice) : '-'}/人
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-foreground-muted">合計金額</span>
              <span className="text-lg font-bold text-foreground">
                {calculation ? formatPrice(calculation.totalPrice) : '-'}
              </span>
            </div>
          </div>

          {/* 支払い方法 */}
          {paymentMethod && (
            <div className="p-4 rounded-lg bg-background-secondary">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-foreground-muted" aria-hidden="true" />
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
            メンバーの追加・削除時は自動的に数量が調整され、次回請求に反映されます。
          </p>
        </div>
      )}
    </div>
  );
}
