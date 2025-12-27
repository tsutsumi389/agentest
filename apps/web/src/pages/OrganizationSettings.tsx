import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router';
import {
  Building2,
  Settings,
  Users,
  Mail,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { organizationsApi, ApiError, type Organization } from '../lib/api';
import { useOrganization } from '../contexts/OrganizationContext';
import { toast } from '../stores/toast';
import { MemberList } from '../components/organization/MemberList';

type SettingsTab = 'general' | 'members' | 'invitations' | 'audit-logs' | 'danger';

/**
 * 組織設定ページ
 */
export function OrganizationSettingsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organizations, refreshOrganizations } = useOrganization();

  // タブ状態
  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabParam && ['general', 'members', 'invitations', 'audit-logs', 'danger'].includes(tabParam)
      ? tabParam
      : 'general'
  );

  // 組織データ
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 現在のユーザーのロール
  const currentRole = organizations.find(
    (o) => o.organization.id === organizationId
  )?.role;

  // 組織データを取得
  const fetchOrganization = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await organizationsApi.getById(organizationId);
      setOrganization(response.organization);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setError('組織が見つかりません');
        } else if (err.statusCode === 403) {
          setError('この組織にアクセスする権限がありません');
        } else {
          setError(err.message);
        }
      } else {
        setError('組織の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  // タブを変更するとURLパラメータも更新
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    searchParams.set('tab', tab);
    setSearchParams(searchParams, { replace: true });
  };

  // 組織更新後のコールバック
  const handleOrganizationUpdated = (updated: Organization) => {
    setOrganization(updated);
    refreshOrganizations();
  };

  // タブ定義
  const tabs = [
    { id: 'general' as const, label: '一般', icon: Settings },
    { id: 'members' as const, label: 'メンバー', icon: Users },
    { id: 'invitations' as const, label: '招待', icon: Mail },
    { id: 'audit-logs' as const, label: '監査ログ', icon: FileText },
    { id: 'danger' as const, label: '危険な操作', icon: AlertTriangle },
  ];

  // OWNER/ADMINのみアクセス可能
  // currentRoleがundefined（組織に未所属）またはMEMBERの場合は権限エラー
  const hasPermission = currentRole === 'OWNER' || currentRole === 'ADMIN';
  if (!isLoading && !hasPermission) {
    return (
      <div className="space-y-6">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            アクセス権限がありません
          </h2>
          <p className="text-foreground-muted mb-4">
            組織設定にアクセスするには、オーナーまたは管理者権限が必要です。
          </p>
          <Link to="/organizations" className="btn btn-primary">
            組織一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="space-y-6">
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {error || '組織が見つかりません'}
          </h2>
          <Link to="/organizations" className="btn btn-primary">
            組織一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/organizations')}
          className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-lg transition-colors"
          aria-label="組織一覧に戻る"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-foreground-muted" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{organization.name}</h1>
            <p className="text-foreground-muted text-sm">/{organization.slug}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* タブナビゲーション */}
        <nav className="lg:w-48 flex-shrink-0">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors
                    ${activeTab === tab.id
                      ? 'bg-accent-subtle text-accent'
                      : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                    }
                    ${tab.id === 'danger' ? 'text-danger hover:text-danger' : ''}
                  `}
                >
                  <tab.icon className={`w-4 h-4 ${tab.id === 'danger' && activeTab !== tab.id ? 'text-danger' : ''}`} />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* コンテンツ */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <GeneralSettings
              organization={organization}
              onUpdated={handleOrganizationUpdated}
            />
          )}
          {activeTab === 'members' && (
            <MembersSettings organizationId={organization.id} currentRole={currentRole} />
          )}
          {activeTab === 'invitations' && (
            <InvitationsSettings organizationId={organization.id} currentRole={currentRole} />
          )}
          {activeTab === 'audit-logs' && (
            <AuditLogsSettings organizationId={organization.id} />
          )}
          {activeTab === 'danger' && (
            <DangerSettings
              organization={organization}
              currentRole={currentRole}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 一般設定タブ
 */
function GeneralSettings({
  organization,
  onUpdated,
}: {
  organization: Organization;
  onUpdated: (org: Organization) => void;
}) {
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description || '');
  const [billingEmail, setBillingEmail] = useState(organization.billingEmail || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 組織データが変更されたらフォームをリセット
  useEffect(() => {
    setName(organization.name);
    setDescription(organization.description || '');
    setBillingEmail(organization.billingEmail || '');
    setErrors({});
  }, [organization]);

  const hasChanges =
    name !== organization.name ||
    description !== (organization.description || '') ||
    billingEmail !== (organization.billingEmail || '');

  // 入力値を元に戻す
  const handleCancel = () => {
    setName(organization.name);
    setDescription(organization.description || '');
    setBillingEmail(organization.billingEmail || '');
    setErrors({});
  };

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '組織名は必須です';
    } else if (name.length > 100) {
      newErrors.name = '組織名は100文字以内で入力してください';
    }

    if (description.length > 500) {
      newErrors.description = '説明は500文字以内で入力してください';
    }

    if (billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
      newErrors.billingEmail = '有効なメールアドレスを入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const response = await organizationsApi.update(organization.id, {
        name: name.trim(),
        description: description.trim() || null,
        billingEmail: billingEmail.trim() || null,
      });

      onUpdated(response.organization);
      toast.success('組織情報を更新しました');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [field, messages] of Object.entries(err.details)) {
            fieldErrors[field] = messages[0];
          }
          setErrors(fieldErrors);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('組織情報の更新に失敗しました');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">一般設定</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 組織名 */}
        <div>
          <label htmlFor="org-name" className="block text-sm font-medium text-foreground mb-1">
            組織名 <span className="text-danger">*</span>
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: '' }));
            }}
            className={`input w-full max-w-md ${errors.name ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
            disabled={isSaving}
          />
          {errors.name && (
            <p className="text-xs text-danger mt-1">{errors.name}</p>
          )}
        </div>

        {/* スラッグ（読み取り専用） */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            スラッグ
          </label>
          <input
            type="text"
            value={organization.slug}
            disabled
            className="input w-full max-w-md bg-background-tertiary font-mono text-sm"
          />
          <p className="text-xs text-foreground-subtle mt-1">
            スラッグは変更できません
          </p>
        </div>

        {/* 説明 */}
        <div>
          <label htmlFor="org-description" className="block text-sm font-medium text-foreground mb-1">
            説明
          </label>
          <textarea
            id="org-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((prev) => ({ ...prev, description: '' }));
            }}
            rows={3}
            className={`input w-full max-w-md resize-none ${errors.description ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
            disabled={isSaving}
            placeholder="組織の説明（任意）"
          />
          {errors.description && (
            <p className="text-xs text-danger mt-1">{errors.description}</p>
          )}
        </div>

        {/* 請求先メール */}
        <div>
          <label htmlFor="billing-email" className="block text-sm font-medium text-foreground mb-1">
            請求先メール
          </label>
          <input
            id="billing-email"
            type="email"
            value={billingEmail}
            onChange={(e) => {
              setBillingEmail(e.target.value);
              setErrors((prev) => ({ ...prev, billingEmail: '' }));
            }}
            className={`input w-full max-w-md ${errors.billingEmail ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
            disabled={isSaving}
            placeholder="billing@example.com"
          />
          {errors.billingEmail && (
            <p className="text-xs text-danger mt-1">{errors.billingEmail}</p>
          )}
          <p className="text-xs text-foreground-subtle mt-1">
            請求関連の通知を受け取るメールアドレス
          </p>
        </div>

        {/* ボタン */}
        <div className="pt-4 flex gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSaving || !hasChanges}
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? '保存中...' : '保存'}
          </button>
          {hasChanges && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              disabled={isSaving}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/**
 * メンバー設定タブ
 */
function MembersSettings({
  organizationId,
  currentRole,
}: {
  organizationId: string;
  currentRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}) {
  return (
    <MemberList organizationId={organizationId} currentRole={currentRole} />
  );
}

/**
 * 招待設定タブ（プレースホルダー）
 */
function InvitationsSettings(_props: {
  organizationId: string;
  currentRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">招待管理</h2>
      <p className="text-foreground-muted">
        招待管理機能は次のステップで実装されます。
      </p>
    </div>
  );
}

/**
 * 監査ログタブ（プレースホルダー）
 */
function AuditLogsSettings(_props: {
  organizationId: string;
}) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">監査ログ</h2>
      <p className="text-foreground-muted">
        監査ログ機能は次のステップで実装されます。
      </p>
    </div>
  );
}

/**
 * 危険な操作タブ（プレースホルダー）
 */
function DangerSettings({
  currentRole,
}: {
  organization: Organization;
  currentRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}) {
  return (
    <div className="space-y-6">
      {/* オーナー移譲 */}
      <div className="card p-6 border-warning">
        <h3 className="text-lg font-semibold text-foreground mb-2">オーナー権限の移譲</h3>
        <p className="text-foreground-muted text-sm mb-4">
          組織のオーナー権限を別のメンバーに移譲します。
          移譲後、あなたは管理者権限になります。
        </p>
        <button
          className="btn btn-secondary"
          disabled={currentRole !== 'OWNER'}
        >
          オーナー権限を移譲
        </button>
        {currentRole !== 'OWNER' && (
          <p className="text-xs text-foreground-subtle mt-2">
            オーナー権限を持つメンバーのみがこの操作を実行できます
          </p>
        )}
      </div>

      {/* 組織削除 */}
      <div className="card p-6 border-danger">
        <h3 className="text-lg font-semibold text-danger mb-2">組織を削除</h3>
        <p className="text-foreground-muted text-sm mb-4">
          組織を削除すると、すべてのプロジェクト、テスト、メンバー情報が削除されます。
          削除後30日間は復元可能ですが、30日経過後は完全に削除され復元できません。
        </p>
        <button
          className="btn btn-danger"
          disabled={currentRole !== 'OWNER'}
        >
          組織を削除
        </button>
        {currentRole !== 'OWNER' && (
          <p className="text-xs text-foreground-subtle mt-2">
            オーナー権限を持つメンバーのみがこの操作を実行できます
          </p>
        )}
      </div>
    </div>
  );
}
