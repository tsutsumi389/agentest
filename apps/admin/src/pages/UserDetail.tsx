import { useParams, Navigate } from 'react-router';
import { RefreshCw, Calendar, Clock } from 'lucide-react';
import { useAdminUserDetail } from '../hooks/useAdminUserDetail';
import {
  UserDetailHeader,
  UserActivitySection,
  UserStatsSection,
  UserOrganizationsSection,
  UserOAuthSection,
  UserAuditLogSection,
} from '../components/users';
import { formatDateTime } from '../lib/date-utils';

/**
 * ユーザー詳細ページ
 */
export function UserDetail() {
  const { id } = useParams<{ id: string }>();

  // フックは条件分岐の前に呼び出す（React Hooks のルール）
  // enabled: !!userId により、id が空の場合はクエリは実行されない
  const { data, isLoading, isFetching, error, refetch } = useAdminUserDetail(
    id ?? ''
  );

  // IDが未指定の場合は一覧へリダイレクト
  if (!id) {
    return <Navigate to="/users" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ローディング */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-8 h-8 text-foreground-muted animate-spin" />
          </div>
        )}

        {/* エラー */}
        {error && !isLoading && (
          <div className="bg-error/10 border border-error/20 rounded-lg p-6 text-center">
            <p className="text-error font-medium mb-2">
              ユーザー情報の取得に失敗しました
            </p>
            <p className="text-sm text-foreground-muted mb-4">
              {error instanceof Error ? error.message : 'エラーが発生しました'}
            </p>
            <button
              onClick={() => refetch()}
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              再試行
            </button>
          </div>
        )}

        {/* データ表示 */}
        {data && !isLoading && (
          <div className="space-y-6">
            {/* ヘッダー（戻るボタン + ユーザー情報） */}
            <div className="flex items-start justify-between">
              <UserDetailHeader user={data.user} />
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="btn btn-secondary flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                />
                更新
              </button>
            </div>

            {/* 基本情報（作成日・更新日） */}
            <div className="bg-background-secondary border border-border rounded-lg p-4">
              <h2 className="text-sm font-medium text-foreground-muted mb-4">
                基本情報
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-foreground-muted" />
                  <div>
                    <p className="text-sm text-foreground-muted">作成日</p>
                    <p className="text-sm text-foreground">
                      {formatDateTime(data.user.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-foreground-muted" />
                  <div>
                    <p className="text-sm text-foreground-muted">更新日</p>
                    <p className="text-sm text-foreground">
                      {formatDateTime(data.user.updatedAt)}
                    </p>
                  </div>
                </div>
                {data.user.deletedAt && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-error" />
                    <div>
                      <p className="text-sm text-foreground-muted">削除日</p>
                      <p className="text-sm text-error">
                        {formatDateTime(data.user.deletedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* アクティビティ */}
            <UserActivitySection activity={data.user.activity} />

            {/* 統計 */}
            <UserStatsSection stats={data.user.stats} />

            {/* 組織・OAuth */}
            <div className="space-y-6">
              <UserOrganizationsSection
                organizations={data.user.organizations}
              />
              <UserOAuthSection providers={data.user.oauthProviders} />
            </div>

            {/* 監査ログ（フル幅） */}
            <UserAuditLogSection logs={data.user.recentAuditLogs} />
          </div>
        )}
    </div>
  );
}
