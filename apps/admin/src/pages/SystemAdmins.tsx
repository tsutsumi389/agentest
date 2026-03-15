import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Shield, RefreshCw, Plus } from 'lucide-react';
import type {
  SystemAdminSearchParams,
  SystemAdminSortBy,
  SystemAdminStatus,
  SystemAdminRole,
  SystemAdminListItem,
} from '@agentest/shared/types';
import {
  useSystemAdmins,
  useInviteSystemAdmin,
  useDeleteSystemAdmin,
  useUnlockSystemAdmin,
  useReset2FASystemAdmin,
} from '../hooks/useSystemAdmins';
import {
  SystemAdminTable,
  SystemAdminSearchForm,
  SystemAdminFilters,
  SystemAdminInviteModal,
} from '../components/system-admins';
import { useAdminAuthStore } from '../stores/admin-auth.store';

/**
 * システム管理者一覧ページ
 */
export function SystemAdmins() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const currentAdmin = useAdminAuthStore((state) => state.admin);

  // SUPER_ADMIN権限チェック
  const isSuperAdmin = currentAdmin?.role === 'SUPER_ADMIN';

  // 検索パラメータを取得
  const params: SystemAdminSearchParams = {
    q: searchParams.get('q') || undefined,
    role: searchParams.get('role')
      ? (searchParams.get('role')!.split(',') as SystemAdminRole[])
      : undefined,
    status: (searchParams.get('status') as SystemAdminStatus) || 'active',
    totpEnabled: searchParams.get('totpEnabled')
      ? searchParams.get('totpEnabled') === 'true'
      : undefined,
    createdFrom: searchParams.get('createdFrom') || undefined,
    createdTo: searchParams.get('createdTo') || undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    sortBy: (searchParams.get('sortBy') as SystemAdminSortBy) || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  // データ取得
  const { data, isLoading, isFetching, refetch } = useSystemAdmins(params);

  // ミューテーション
  const inviteMutation = useInviteSystemAdmin();
  const deleteMutation = useDeleteSystemAdmin();
  const unlockMutation = useUnlockSystemAdmin();
  const reset2FAMutation = useReset2FASystemAdmin();

  // パラメータ更新ヘルパー
  const updateParams = useCallback(
    (updates: Partial<SystemAdminSearchParams>) => {
      const newParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
          newParams.delete(key);
        } else if (Array.isArray(value)) {
          newParams.set(key, value.join(','));
        } else if (typeof value === 'boolean') {
          newParams.set(key, String(value));
        } else {
          newParams.set(key, String(value));
        }
      });

      // ページをリセット（検索条件変更時）
      if (!('page' in updates)) {
        newParams.delete('page');
      }

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // ソート処理
  const handleSort = (sortBy: SystemAdminSortBy) => {
    if (params.sortBy === sortBy) {
      updateParams({
        sortOrder: params.sortOrder === 'asc' ? 'desc' : 'asc',
        page: 1,
      });
    } else {
      updateParams({ sortBy, sortOrder: 'desc', page: 1 });
    }
  };

  // フィルタークリア
  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // 招待処理
  const handleInvite = async (inviteData: {
    email: string;
    name: string;
    role: SystemAdminRole;
  }) => {
    await inviteMutation.mutateAsync(inviteData);
  };

  // APIエラーからメッセージを取得するヘルパー
  const getErrorMessage = (error: unknown, defaultMessage: string): string => {
    if (error instanceof Error) {
      return error.message;
    }
    return defaultMessage;
  };

  // 削除処理
  const handleDelete = async (admin: SystemAdminListItem) => {
    if (!confirm(`"${admin.name}" を削除しますか？`)) return;
    try {
      await deleteMutation.mutateAsync(admin.id);
    } catch (error) {
      alert(getErrorMessage(error, '削除に失敗しました'));
    }
  };

  // ロック解除処理
  const handleUnlock = async (admin: SystemAdminListItem) => {
    if (!confirm(`"${admin.name}" のロックを解除しますか？`)) return;
    try {
      await unlockMutation.mutateAsync(admin.id);
    } catch (error) {
      alert(getErrorMessage(error, 'ロック解除に失敗しました'));
    }
  };

  // 2FAリセット処理
  const handleReset2FA = async (admin: SystemAdminListItem) => {
    if (!confirm(`"${admin.name}" の2FA設定をリセットしますか？`)) return;
    try {
      await reset2FAMutation.mutateAsync(admin.id);
    } catch (error) {
      alert(getErrorMessage(error, '2FAリセットに失敗しました'));
    }
  };

  // SUPER_ADMIN権限がない場合はアクセス拒否
  if (!isSuperAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Shield className="w-12 h-12 mx-auto text-foreground-muted mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">アクセス権限がありません</h1>
          <p className="text-foreground-muted">このページはSUPER_ADMIN権限が必要です。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* タイトル */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-accent" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">システム管理者一覧</h1>
              <p className="text-foreground-muted mt-1">管理者アカウントの管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              更新
            </button>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              管理者を招待
            </button>
          </div>
        </div>

        {/* 検索・フィルター */}
        <div className="bg-background-secondary border border-border rounded-lg p-4 space-y-4">
          <SystemAdminSearchForm value={params.q || ''} onChange={(q) => updateParams({ q })} />
          <SystemAdminFilters
            role={params.role || []}
            status={params.status || 'active'}
            totpEnabled={params.totpEnabled}
            createdFrom={params.createdFrom || ''}
            createdTo={params.createdTo || ''}
            onRoleChange={(role) => updateParams({ role })}
            onStatusChange={(status) => updateParams({ status })}
            onTotpEnabledChange={(totpEnabled) => updateParams({ totpEnabled })}
            onCreatedFromChange={(createdFrom) => updateParams({ createdFrom })}
            onCreatedToChange={(createdTo) => updateParams({ createdTo })}
            onClear={handleClearFilters}
          />
        </div>

        {/* テーブル */}
        <div className="bg-background-secondary border border-border rounded-lg">
          {isLoading ? (
            <div className="text-center text-foreground-muted py-12">読み込み中...</div>
          ) : data ? (
            <SystemAdminTable
              admins={data.adminUsers}
              pagination={data.pagination}
              sortBy={params.sortBy || 'createdAt'}
              sortOrder={params.sortOrder || 'desc'}
              onSort={handleSort}
              onPageChange={(page) => updateParams({ page })}
              onDelete={handleDelete}
              onUnlock={handleUnlock}
              onReset2FA={handleReset2FA}
            />
          ) : (
            <div className="text-center text-foreground-muted py-12">
              データを取得できませんでした
            </div>
          )}
        </div>
      </div>

      {/* 招待モーダル */}
      <SystemAdminInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSubmit={handleInvite}
        isLoading={inviteMutation.isPending}
      />
    </div>
  );
}
