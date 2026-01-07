import { NavLink } from 'react-router';
import {
  X,
  LayoutDashboard,
  FolderKanban,
  Play,
  FileText,
  Building2,
} from 'lucide-react';
import { AgentestLogo } from '../ui/AgentestLogo';
import { useEffect } from 'react';
import { OrganizationSelector } from '../organization';

interface SlideoverMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * ナビゲーションリンク定義
 */
const navLinks = [
  { to: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { to: '/projects', label: 'プロジェクト', icon: FolderKanban },
  { to: '/executions', label: 'テスト実行', icon: Play },
  { to: '/reports', label: 'レポート', icon: FileText },
];

/**
 * スライドオーバーメニュー
 * ハンバーガーメニューから開くメインナビゲーション
 */
export function SlideoverMenu({ isOpen, onClose }: SlideoverMenuProps) {
  // Escで閉じる
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // スクロール無効化
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/50 z-overlay animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* スライドオーバーパネル */}
      <aside
        className="fixed top-0 left-0 z-modal h-full w-72 bg-background-secondary border-r border-border shadow-lg animate-slide-in-left"
        role="dialog"
        aria-modal="true"
        aria-label="メインメニュー"
      >
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-border">
            <div className="flex items-center gap-2">
              <AgentestLogo className="w-6 h-6 text-accent" />
              <span className="font-semibold text-foreground">Agentest</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
              aria-label="メニューを閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ナビゲーション */}
          <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* 組織セレクター */}
            <div>
              <p className="px-3 py-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
                ワークスペース
              </p>
              <OrganizationSelector onClose={onClose} />
            </div>

            {/* メインメニュー */}
            <div className="space-y-1">
              <p className="px-3 py-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
                メインメニュー
              </p>
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accent-subtle text-accent'
                        : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
                    }`
                  }
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </NavLink>
              ))}

              {/* 組織一覧へのリンク */}
              <NavLink
                to="/organizations"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent-subtle text-accent'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
                  }`
                }
              >
                <Building2 className="w-5 h-5" />
                組織
              </NavLink>
            </div>
          </nav>

          {/* フッター */}
          <div className="p-4 border-t border-border">
            <p className="text-xs text-foreground-muted text-center">
              キーボードショートカット: ⌘K
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
