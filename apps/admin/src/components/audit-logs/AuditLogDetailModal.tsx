import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { AdminAuditLogEntry } from '@agentest/shared/types';
import { formatDateTime } from '../../lib/date-utils';
import { CATEGORY_LABELS } from '../../lib/audit-log-utils';

interface AuditLogDetailModalProps {
  log: AdminAuditLogEntry;
  onClose: () => void;
}

/**
 * 監査ログ詳細モーダル
 */
export function AuditLogDetailModal({ log, onClose }: AuditLogDetailModalProps) {
  // Escapeキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 背景クリックで閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-background-secondary border border-border rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">監査ログ詳細</h2>
          <button
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground rounded hover:bg-background-tertiary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-60px)]">
          <div className="space-y-4">
            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="ID" value={log.id} mono />
              <DetailItem label="日時" value={formatDateTime(log.createdAt)} />
              <DetailItem label="カテゴリ" value={CATEGORY_LABELS[log.category] || log.category} />
              <DetailItem label="アクション" value={log.action} />
              <DetailItem label="対象タイプ" value={log.targetType || '-'} />
              <DetailItem label="対象ID" value={log.targetId || '-'} mono />
            </div>

            {/* 組織情報 */}
            {log.organization && (
              <div className="pt-2 border-t border-border">
                <h3 className="text-sm font-medium text-foreground-muted mb-2">組織</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="組織名" value={log.organization.name} />
                  <DetailItem label="組織ID" value={log.organization.id} mono />
                </div>
              </div>
            )}

            {/* ユーザー情報 */}
            {log.user && (
              <div className="pt-2 border-t border-border">
                <h3 className="text-sm font-medium text-foreground-muted mb-2">実行ユーザー</h3>
                <div className="grid grid-cols-2 gap-4">
                  <DetailItem label="名前" value={log.user.name} />
                  <DetailItem label="メール" value={log.user.email} />
                  <DetailItem label="ユーザーID" value={log.user.id} mono />
                </div>
              </div>
            )}

            {/* リクエスト情報 */}
            <div className="pt-2 border-t border-border">
              <h3 className="text-sm font-medium text-foreground-muted mb-2">リクエスト情報</h3>
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="IPアドレス" value={log.ipAddress || '-'} mono />
              </div>
              {log.userAgent && (
                <div className="mt-2">
                  <span className="text-xs text-foreground-muted">ユーザーエージェント</span>
                  <p className="text-sm text-foreground font-mono bg-background-tertiary p-2 rounded mt-1 break-all">
                    {log.userAgent}
                  </p>
                </div>
              )}
            </div>

            {/* 詳細情報（JSON） */}
            {log.details && Object.keys(log.details).length > 0 && (
              <div className="pt-2 border-t border-border">
                <h3 className="text-sm font-medium text-foreground-muted mb-2">詳細情報</h3>
                <pre className="text-sm text-foreground font-mono bg-background-tertiary p-4 rounded overflow-x-auto">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 詳細項目
 */
function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-xs text-foreground-muted">{label}</span>
      <p className={`text-sm text-foreground ${mono ? 'font-mono' : ''} break-all`}>{value}</p>
    </div>
  );
}
