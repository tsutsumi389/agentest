import { Outlet, NavLink, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  LogOut,
  Menu,
  X,
  FlaskConical,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { ToastContainer } from './Toast';

/**
 * ナビゲーションリンク
 */
const navLinks = [
  { to: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { to: '/projects', label: 'プロジェクト', icon: FolderKanban },
  { to: '/settings', label: '設定', icon: Settings },
];

/**
 * サイドバーナビゲーション
 */
function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* モバイルオーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-overlay lg:hidden"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`
          fixed top-0 left-0 z-modal h-full w-60 bg-background-secondary border-r border-border
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-border">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-accent" />
              <span className="font-semibold text-foreground">Agentest</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-foreground-muted hover:text-foreground lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ナビゲーション */}
          <nav className="flex-1 p-4 space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent-subtle text-accent'
                      : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                  }`
                }
              >
                <link.icon className="w-5 h-5" />
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* ユーザーメニュー */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-accent-subtle flex items-center justify-center">
                  <span className="text-sm font-medium text-accent">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-foreground-muted truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/**
 * レイアウトコンポーネント
 */
export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Skip Link - キーボードナビゲーション用 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-tooltip focus:px-4 focus:py-2 focus:bg-accent focus:text-background focus:rounded focus:font-medium"
      >
        コンテンツにスキップ
      </a>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:pl-0">
        {/* モバイルヘッダー */}
        <header className="sticky top-0 z-header flex items-center h-14 px-4 bg-background-secondary border-b border-border lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-foreground-muted hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <FlaskConical className="w-5 h-5 text-accent" />
            <span className="font-semibold text-foreground">Agentest</span>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main id="main-content" className="flex-1 p-6" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {/* トースト通知 */}
      <ToastContainer />
    </div>
  );
}
