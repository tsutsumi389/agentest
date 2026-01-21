import { useEffect, useRef } from 'react';
import {
  X,
  User,
  Shield,
  Building2,
  Users,
  FolderKanban,
  Key,
  CreditCard,
  HelpCircle,
  Globe,
  Monitor,
  Calendar,
  Target,
} from 'lucide-react';
import type { AuditLog } from '../../lib/api';
import { formatDateTime } from '../../lib/date';

interface AuditLogDetailModalProps {
  /** モーダルの表示状態 */
  isOpen: boolean;
  /** 監査ログ */
  log: AuditLog | null;
  /** 閉じる際のコールバック */
  onClose: () => void;
}

/**
 * 監査ログのカテゴリ定義
 */
const AUDIT_LOG_CATEGORIES = {
  AUTH: { label: '認証', icon: Shield, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  USER: { label: 'ユーザー', icon: User, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  ORGANIZATION: { label: '組織', icon: Building2, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  MEMBER: { label: 'メンバー', icon: Users, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  PROJECT: { label: 'プロジェクト', icon: FolderKanban, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  API_TOKEN: { label: 'APIトークン', icon: Key, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  BILLING: { label: '課金', icon: CreditCard, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
} as const;

type CategoryKey = keyof typeof AUDIT_LOG_CATEGORIES;

/**
 * カテゴリキーかどうかを判定する型ガード
 */
function isCategoryKey(key: string): key is CategoryKey {
  return key in AUDIT_LOG_CATEGORIES;
}

/**
 * 既知のフィールドラベルマッピング
 */
const KNOWN_FIELD_LABELS: Record<string, string> = {
  email: 'メールアドレス',
  name: '名前',
  role: 'ロール',
  oldRole: '変更前ロール',
  newRole: '変更後ロール',
  targetName: '対象名',
  reason: '理由',
  description: '説明',
  ipAddress: 'IPアドレス',
  provider: 'プロバイダー',
  tokenName: 'トークン名',
  planFrom: '変更前プラン',
  planTo: '変更後プラン',
};

/**
 * 値を表示用文字列に変換
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value || '-';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(', ') || '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * 監査ログ詳細モーダルコンポーネント
 */
export function AuditLogDetailModal({
  isOpen,
  log,
  onClose,
}: AuditLogDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ESCキーでモーダルを閉じる + フォーカストラップ + 背景スクロール無効化
  useEffect(() => {
    if (!isOpen) return;

    // 背景スクロールを無効化
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // フォーカスをモーダルに移動
    closeButtonRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !log) return null;

  // カテゴリ情報の取得
  const categoryInfo = isCategoryKey(log.category)
    ? AUDIT_LOG_CATEGORIES[log.category]
    : { label: log.category, icon: HelpCircle, color: 'text-foreground-muted' as const, bgColor: 'bg-background-tertiary' as const };
  const CategoryIcon = categoryInfo.icon;

  // 詳細情報のフィルタリング（除外フィールド）
  const excludedFields = new Set(['id', 'userId', 'organizationId', 'createdAt', 'updatedAt']);
  const detailEntries = log.details
    ? Object.entries(log.details).filter(([key]) => !excludedFields.has(key))
    : [];

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* モーダル */}
      <div
        ref={modalRef}
        className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-xl max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-log-detail-title"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryInfo.bgColor}`}>
              <CategoryIcon className={`w-5 h-5 ${categoryInfo.color}`} />
            </div>
            <div>
              <h2
                id="audit-log-detail-title"
                className="text-lg font-semibold text-foreground"
              >
                {log.action}
              </h2>
              <span className={`text-sm ${categoryInfo.color}`}>
                {categoryInfo.label}
              </span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 日時セクション */}
          <section>
            <h3 className="text-sm font-medium text-foreground-muted mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              日時
            </h3>
            <p className="text-foreground">{formatDateTime(log.createdAt)}</p>
          </section>

          {/* 実行ユーザーセクション */}
          <section>
            <h3 className="text-sm font-medium text-foreground-muted mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              実行ユーザー
            </h3>
            {log.user ? (
              <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg">
                {log.user.avatarUrl ? (
                  <img
                    src={log.user.avatarUrl}
                    alt={log.user.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent-subtle flex items-center justify-center">
                    <span className="text-sm font-medium text-accent">
                      {log.user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-foreground font-medium">{log.user.name}</p>
                  <p className="text-sm text-foreground-muted">{log.user.email}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg">
                <div className="w-10 h-10 rounded-full bg-background-tertiary flex items-center justify-center">
                  <User className="w-5 h-5 text-foreground-muted" />
                </div>
                <p className="text-foreground-muted">システム</p>
              </div>
            )}
          </section>

          {/* 対象リソースセクション */}
          {(log.targetType || log.targetId) && (
            <section>
              <h3 className="text-sm font-medium text-foreground-muted mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" />
                対象リソース
              </h3>
              <div className="p-3 bg-background-secondary rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {log.targetType && (
                    <div>
                      <span className="text-foreground-muted">種別:</span>
                      <span className="ml-2 text-foreground">{log.targetType}</span>
                    </div>
                  )}
                  {log.targetId && (
                    <div>
                      <span className="text-foreground-muted">ID:</span>
                      <span className="ml-2 text-foreground font-mono text-xs">{log.targetId}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* アクセス情報セクション */}
          {(log.ipAddress || log.userAgent) && (
            <section>
              <h3 className="text-sm font-medium text-foreground-muted mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                アクセス情報
              </h3>
              <div className="p-3 bg-background-secondary rounded-lg space-y-2">
                {log.ipAddress && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                    <span className="text-foreground-muted">IPアドレス:</span>
                    <span className="text-foreground font-mono">{log.ipAddress}</span>
                  </div>
                )}
                {log.userAgent && (
                  <div className="flex items-start gap-2 text-sm">
                    <Monitor className="w-4 h-4 text-foreground-muted flex-shrink-0 mt-0.5" />
                    <span className="text-foreground-muted flex-shrink-0">UserAgent:</span>
                    <span className="text-foreground text-xs break-all">{log.userAgent}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 詳細情報セクション */}
          {detailEntries.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground-muted mb-2">詳細情報</h3>
              <div className="p-3 bg-background-secondary rounded-lg">
                <dl className="space-y-2">
                  {detailEntries.map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:gap-2">
                      <dt className="text-sm text-foreground-muted flex-shrink-0 sm:w-32">
                        {KNOWN_FIELD_LABELS[key] || key}:
                      </dt>
                      <dd className="text-sm text-foreground break-all">
                        {typeof value === 'object' && value !== null ? (
                          <pre className="text-xs bg-background-tertiary p-2 rounded overflow-x-auto">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          formatValue(value)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-end p-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="btn btn-ghost"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
