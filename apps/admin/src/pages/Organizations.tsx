import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import {
  LayoutDashboard,
  Building2,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router';
import type {
  AdminOrganizationSearchParams,
  AdminOrganizationSortBy,
  AdminOrganizationStatus,
} from '@agentest/shared';
import { useAdminOrganizations } from '../hooks/useAdminOrganizations';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { OrganizationTable, OrganizationSearchForm, OrganizationFilters } from '../components/organizations';

/**
 * 組織一覧ページ
 */
export function Organizations() {
  const navigate = useNavigate();
  const { admin, logout } = useAdminAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // URLSearchParams を使って検索条件を管理
  const [searchParams, setSearchParams] = useSearchParams();

  // 検索パラメータを取得
  const params: AdminOrganizationSearchParams = {
    q: searchParams.get('q') || undefined,
    plan: searchParams.get('plan')
      ? (searchParams.get('plan')!.split(',') as ('TEAM' | 'ENTERPRISE')[])
      : undefined,
    status: (searchParams.get('status') as AdminOrganizationStatus) || 'active',
    createdFrom: searchParams.get('createdFrom') || undefined,
    createdTo: searchParams.get('createdTo') || undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    sortBy: (searchParams.get('sortBy') as AdminOrganizationSortBy) || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  // データ取得
  const { data, isLoading, isFetching, refetch } = useAdminOrganizations(params);

  // パラメータ更新ヘルパー
  const updateParams = useCallback(
    (updates: Partial<AdminOrganizationSearchParams>) => {
      const newParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
          newParams.delete(key);
        } else if (Array.isArray(value)) {
          newParams.set(key, value.join(','));
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

  // ログアウト処理
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('ログアウトに失敗しました', error);
      setIsLoggingOut(false);
    }
  };

  // ソート処理
  const handleSort = (sortBy: AdminOrganizationSortBy) => {
    if (params.sortBy === sortBy) {
      // 同じカラムの場合は順序を反転
      updateParams({
        sortOrder: params.sortOrder === 'asc' ? 'desc' : 'asc',
        page: 1,
      });
    } else {
      // 別カラムの場合はdescでソート
      updateParams({ sortBy, sortOrder: 'desc', page: 1 });
    }
  };

  // フィルタークリア
  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="bg-background-secondary border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-6 h-6 text-accent" />
                <span className="text-lg font-semibold text-foreground">
                  Agentest Admin
                </span>
              </div>
              <nav className="flex items-center gap-4">
                <Link
                  to="/"
                  className="text-sm font-medium text-foreground-muted hover:text-foreground"
                >
                  ダッシュボード
                </Link>
                <Link
                  to="/users"
                  className="text-sm font-medium text-foreground-muted hover:text-foreground"
                >
                  ユーザー
                </Link>
                <Link
                  to="/organizations"
                  className="text-sm font-medium text-accent"
                >
                  組織
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-foreground-muted">
                {admin?.name ?? '管理者'}
              </span>
              <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center">
                <span className="text-sm font-medium text-accent">A</span>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="btn btn-ghost p-2"
                title="ログアウト"
              >
                <LogOut className={`w-5 h-5 ${isLoggingOut ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* タイトル */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-accent" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">組織一覧</h1>
                <p className="text-foreground-muted mt-1">
                  登録組織の一覧と統計
                </p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              更新
            </button>
          </div>

          {/* 検索・フィルター */}
          <div className="bg-background-secondary border border-border rounded-lg p-4 space-y-4">
            <OrganizationSearchForm
              value={params.q || ''}
              onChange={(q) => updateParams({ q })}
            />
            <OrganizationFilters
              plan={params.plan || []}
              status={params.status || 'active'}
              createdFrom={params.createdFrom || ''}
              createdTo={params.createdTo || ''}
              onPlanChange={(plan) => updateParams({ plan })}
              onStatusChange={(status) => updateParams({ status })}
              onCreatedFromChange={(createdFrom) => updateParams({ createdFrom })}
              onCreatedToChange={(createdTo) => updateParams({ createdTo })}
              onClear={handleClearFilters}
            />
          </div>

          {/* テーブル */}
          <div className="bg-background-secondary border border-border rounded-lg">
            {isLoading ? (
              <div className="text-center text-foreground-muted py-12">
                読み込み中...
              </div>
            ) : data ? (
              <OrganizationTable
                organizations={data.organizations}
                pagination={data.pagination}
                sortBy={params.sortBy || 'createdAt'}
                sortOrder={params.sortOrder || 'desc'}
                onSort={handleSort}
                onPageChange={(page) => updateParams({ page })}
              />
            ) : (
              <div className="text-center text-foreground-muted py-12">
                データを取得できませんでした
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
