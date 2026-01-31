import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import type { AdminOrganizationDetail } from '@agentest/shared';
import { OrganizationPlanBadge } from '../common';

interface OrganizationDetailHeaderProps {
  organization: AdminOrganizationDetail;
}

/**
 * 組織詳細ヘッダー
 */
export function OrganizationDetailHeader({ organization }: OrganizationDetailHeaderProps) {
  return (
    <div className="space-y-4">
      {/* 戻るリンク */}
      <Link
        to="/organizations"
        className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        組織一覧に戻る
      </Link>

      {/* 組織情報 */}
      <div className="flex items-center gap-4">
        {/* アバター */}
        {organization.avatarUrl ? (
          <img
            src={organization.avatarUrl}
            alt={organization.name}
            className="w-16 h-16 rounded-full"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center">
            <span className="text-2xl font-medium text-accent">
              {organization.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* 名前・バッジ・説明 */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{organization.name}</h1>
            <OrganizationPlanBadge plan={organization.plan} />
            {organization.deletedAt && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-error/20 text-error">
                削除済み
              </span>
            )}
          </div>
          {organization.description && (
            <p className="text-foreground-muted">{organization.description}</p>
          )}
          <p className="text-xs text-foreground-muted font-mono">{organization.id}</p>
        </div>
      </div>
    </div>
  );
}
