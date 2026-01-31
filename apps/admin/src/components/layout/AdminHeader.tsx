import { useState } from 'react';
import { LayoutDashboard, LogOut, Loader2, Menu } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface AdminHeaderProps {
  onMenuClick: () => void;
}

/**
 * 管理画面共通ヘッダー
 */
export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, logout } = useAdminAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  // ナビゲーションリンクのスタイルを取得
  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return `text-sm font-medium ${
      isActive
        ? 'text-accent'
        : 'text-foreground-muted hover:text-foreground'
    }`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-header bg-background-secondary border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {/* ハンバーガーメニューボタン */}
            <button
              onClick={onMenuClick}
              className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors md:hidden"
              aria-label="メニューを開く"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-6 h-6 text-accent" />
              <span className="text-lg font-semibold text-foreground">
                Agentest Admin
              </span>
            </div>
            {/* デスクトップ用ナビゲーション */}
            <nav className="hidden md:flex items-center gap-4 ml-2">
              <Link to="/" className={getLinkClass('/')}>
                ダッシュボード
              </Link>
              <Link to="/users" className={getLinkClass('/users')}>
                ユーザー
              </Link>
              <Link to="/organizations" className={getLinkClass('/organizations')}>
                組織
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground-muted hidden sm:inline">
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
              {isLoggingOut ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <LogOut className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
