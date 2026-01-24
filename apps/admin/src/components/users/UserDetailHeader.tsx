import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import type { AdminUserDetail } from '@agentest/shared';
import { PlanBadge } from '../common';

interface UserDetailHeaderProps {
  user: AdminUserDetail;
}

/**
 * ユーザー詳細ヘッダー
 */
export function UserDetailHeader({ user }: UserDetailHeaderProps) {
  return (
    <div className="space-y-4">
      {/* 戻るリンク */}
      <Link
        to="/users"
        className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        ユーザー一覧に戻る
      </Link>

      {/* ユーザー情報 */}
      <div className="flex items-center gap-4">
        {/* アバター */}
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-16 h-16 rounded-full"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center">
            <span className="text-2xl font-medium text-accent">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* 名前・メール・バッジ */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{user.name}</h1>
            <PlanBadge plan={user.plan} />
            {user.deletedAt && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-error/20 text-error">
                削除済み
              </span>
            )}
          </div>
          <p className="text-foreground-muted">{user.email}</p>
          <p className="text-xs text-foreground-muted font-mono">{user.id}</p>
        </div>
      </div>
    </div>
  );
}
