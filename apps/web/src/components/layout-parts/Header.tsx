import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Menu,
  Settings,
  LogOut,
  ChevronDown,
  FlaskConical,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

interface HeaderProps {
  onMenuClick: () => void;
}

/**
 * ヘッダーコンポーネント
 * - 左: ハンバーガーメニュー + ロゴ
 * - 右: ユーザードロップダウン
 */
export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-header h-14 bg-background-secondary border-b border-border">
      <div className="flex items-center justify-between h-full px-4">
        {/* 左: ハンバーガー + ロゴ */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="メニューを開く"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-accent" />
            <span className="font-semibold text-foreground hidden sm:block">
              Agentest
            </span>
          </Link>
        </div>

        {/* 右: ユーザードロップダウン */}
        <UserDropdown />
      </div>
    </header>
  );
}

/**
 * ユーザードロップダウンメニュー
 */
function UserDropdown() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 外部クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Escで閉じる
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 hover:bg-background-tertiary rounded transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
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
        <ChevronDown
          className={`w-4 h-4 text-foreground-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-background-secondary border border-border rounded-lg shadow-lg overflow-hidden">
          {/* ユーザー情報 */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.name}
            </p>
            <p className="text-xs text-foreground-muted truncate">
              {user?.email}
            </p>
          </div>

          {/* メニュー項目 */}
          <div className="py-1">
            <Link
              to="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-foreground-secondary hover:bg-background-tertiary transition-colors"
            >
              <Settings className="w-4 h-4" />
              設定
            </Link>
          </div>

          {/* ログアウト */}
          <div className="border-t border-border py-1">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-foreground-secondary hover:bg-background-tertiary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
