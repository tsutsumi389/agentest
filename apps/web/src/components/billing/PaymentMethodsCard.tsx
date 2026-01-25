/**
 * 支払い方法一覧カード
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CreditCard, Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { ApiError, paymentMethodsApi, type PaymentMethod } from '../../lib/api';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';

/**
 * カードブランドのアイコンを取得
 */
function getCardBrandIcon(brand: string | null): string {
  switch (brand?.toLowerCase()) {
    case 'visa':
      return 'VISA';
    case 'mastercard':
      return 'MC';
    case 'amex':
      return 'AMEX';
    case 'jcb':
      return 'JCB';
    default:
      return 'CARD';
  }
}

/**
 * 有効期限をフォーマット
 */
export function formatExpiry(month: number | null, year: number | null): string {
  if (!month || !year) return '-';
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
}

export function PaymentMethodsCard() {
  const { user } = useAuthStore();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; last4: string | null } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 支払い方法一覧取得
  const fetchPaymentMethods = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await paymentMethodsApi.list(user.id);
      setPaymentMethods(response.paymentMethods);
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('支払い方法取得エラー:', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  // 削除ダイアログを開く
  const openDeleteDialog = (paymentMethodId: string) => {
    const paymentMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);
    if (paymentMethod?.isDefault && paymentMethods.length > 1) {
      toast.error('デフォルトの支払い方法は削除できません。先に他の支払い方法をデフォルトに設定してください。');
      return;
    }
    setDeleteTarget({ id: paymentMethodId, last4: paymentMethod?.last4 || null });
  };

  // 支払い方法削除
  const handleDelete = async () => {
    if (!user?.id || !deleteTarget) return;

    setIsDeleting(true);
    try {
      await paymentMethodsApi.delete(user.id, deleteTarget.id);
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== deleteTarget.id));
      toast.success('支払い方法を削除しました');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('支払い方法の削除に失敗しました');
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // デフォルト設定
  const handleSetDefault = async (paymentMethodId: string) => {
    if (!user?.id) return;

    setSettingDefaultId(paymentMethodId);
    try {
      await paymentMethodsApi.setDefault(user.id, paymentMethodId);
      setPaymentMethods((prev) =>
        prev.map((pm) => ({
          ...pm,
          isDefault: pm.id === paymentMethodId,
        }))
      );
      toast.success('デフォルトの支払い方法を変更しました');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('デフォルト設定に失敗しました');
      }
    } finally {
      setSettingDefaultId(null);
    }
  };

  // 支払い方法追加完了
  const handleAddComplete = (newPaymentMethod: PaymentMethod) => {
    setPaymentMethods((prev) => {
      // 新しい支払い方法がデフォルトの場合、他のデフォルトを解除
      if (newPaymentMethod.isDefault) {
        return [...prev.map((pm) => ({ ...pm, isDefault: false })), newPaymentMethod];
      }
      return [...prev, newPaymentMethod];
    });
    setShowAddModal(false);
    toast.success('支払い方法を追加しました');
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">支払い方法</h2>
            <p className="text-sm text-foreground-muted mt-1">
              サブスクリプションの支払いに使用するカードを管理します
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4" />
            追加
          </button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
            <p className="text-foreground-muted">支払い方法が登録されていません</p>
            <button
              className="btn btn-primary btn-sm mt-4"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4" />
              支払い方法を追加
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((paymentMethod) => (
              <PaymentMethodItem
                key={paymentMethod.id}
                paymentMethod={paymentMethod}
                isDeleting={deleteTarget?.id === paymentMethod.id && isDeleting}
                isSettingDefault={settingDefaultId === paymentMethod.id}
                canDelete={paymentMethods.length === 1 || !paymentMethod.isDefault}
                onDelete={() => openDeleteDialog(paymentMethod.id)}
                onSetDefault={() => handleSetDefault(paymentMethod.id)}
              />
            ))}
          </div>
        )}

        {paymentMethods.length > 0 && (
          <p className="text-xs text-foreground-subtle mt-4">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            カード情報はStripeで安全に管理されています。当サービスではカード番号を保存しません。
          </p>
        )}
      </div>

      {/* 支払い方法追加モーダル */}
      {showAddModal && (
        <AddPaymentMethodModal
          onClose={() => setShowAddModal(false)}
          onComplete={handleAddComplete}
        />
      )}

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="支払い方法を削除"
        message={`カード（•••• ${deleteTarget?.last4 || '****'}）を削除しますか？この操作は取り消せません。`}
        confirmLabel="削除する"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleting}
        isDanger
      />
    </>
  );
}

/**
 * 支払い方法アイテム
 */
function PaymentMethodItem({
  paymentMethod,
  isDeleting,
  isSettingDefault,
  canDelete,
  onDelete,
  onSetDefault,
}: {
  paymentMethod: PaymentMethod;
  isDeleting: boolean;
  isSettingDefault: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${
        paymentMethod.isDefault
          ? 'border-accent bg-accent-subtle'
          : 'border-border bg-background-secondary'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* カードアイコン */}
        <div
          className={`w-12 h-8 rounded flex items-center justify-center text-xs font-bold ${
            paymentMethod.isDefault
              ? 'bg-accent text-white'
              : 'bg-background-tertiary text-foreground-muted'
          }`}
        >
          {getCardBrandIcon(paymentMethod.brand)}
        </div>

        {/* カード情報 */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              •••• {paymentMethod.last4 || '****'}
            </span>
            {paymentMethod.isDefault && (
              <span className="badge badge-accent text-xs">デフォルト</span>
            )}
          </div>
          <p className="text-sm text-foreground-muted">
            有効期限: {formatExpiry(paymentMethod.expiryMonth, paymentMethod.expiryYear)}
          </p>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="flex items-center gap-2">
        {!paymentMethod.isDefault && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onSetDefault}
            disabled={isSettingDefault}
            title="デフォルトに設定"
          >
            {isSettingDefault ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
        )}
        {canDelete && (
          <button
            className="btn btn-ghost btn-sm text-danger hover:bg-danger-subtle"
            onClick={onDelete}
            disabled={isDeleting}
            title="削除"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
