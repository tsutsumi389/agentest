/**
 * 組織課金設定タブ
 * 課金関連コンポーネントを統合したコンテナ
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ApiError, organizationsApi } from '../../../lib/api';
import { OrgCurrentPlanCard } from './OrgCurrentPlanCard';
import { OrgPaymentMethodsCard } from './OrgPaymentMethodsCard';
import { OrgInvoiceList } from './OrgInvoiceList';

interface OrgBillingSettingsProps {
  organizationId: string;
}

export function OrgBillingSettings({ organizationId }: OrgBillingSettingsProps) {
  const [memberCount, setMemberCount] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // メンバー数を取得
  const fetchMemberCount = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await organizationsApi.getMembers(organizationId);
      setMemberCount(response.members.length);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('メンバー情報の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMemberCount();
  }, [fetchMemberCount]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrgCurrentPlanCard organizationId={organizationId} memberCount={memberCount} />
      <OrgPaymentMethodsCard organizationId={organizationId} />
      <OrgInvoiceList organizationId={organizationId} />
    </div>
  );
}
