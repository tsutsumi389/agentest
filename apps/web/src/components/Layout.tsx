import { Outlet } from 'react-router';
import { useState, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { ToastContainer } from './Toast';
import { CommandPalette } from './CommandPalette';
import { Header, SlideoverMenu } from './layout-parts';

/**
 * ページサイドバーのコンテキスト
 */
interface PageSidebarContextType {
  sidebarContent: ReactNode | null;
  setSidebarContent: (content: ReactNode | null) => void;
}

const PageSidebarContext = createContext<PageSidebarContextType>({
  sidebarContent: null,
  setSidebarContent: () => {},
});

/**
 * ページサイドバーを設定するためのフック
 */
export function usePageSidebar() {
  return useContext(PageSidebarContext);
}

/**
 * レイアウトコンポーネント
 *
 * 新しいレイアウト構造:
 * - Header: ハンバーガーメニュー + ロゴ + 検索 + ユーザードロップダウン
 * - SlideoverMenu: ハンバーガーから開くメインナビゲーション
 * - PageSidebar: 各ページ固有のサイドバー（オプション）
 * - Main: メインコンテンツエリア
 */
export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<ReactNode | null>(null);

  return (
    <PageSidebarContext.Provider value={{ sidebarContent, setSidebarContent }}>
      <div className="min-h-screen bg-background">
        {/* Skip Link - キーボードナビゲーション用 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-tooltip focus:px-4 focus:py-2 focus:bg-accent focus:text-background focus:rounded focus:font-medium"
        >
          コンテンツにスキップ
        </a>

        {/* 固定ヘッダー */}
        <Header onMenuClick={() => setMenuOpen(true)} />

        {/* スライドオーバーメニュー */}
        <SlideoverMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

        {/* メインレイアウト */}
        <div className="flex pt-14">
          {/* ページ固有のサイドバー（設定されている場合のみ表示） */}
          {sidebarContent && (
            <aside className="hidden lg:block w-64 flex-shrink-0 h-[calc(100vh-3.5rem)] sticky top-14 bg-background-secondary border-r border-border overflow-y-auto">
              {sidebarContent}
            </aside>
          )}

          {/* メインコンテンツ */}
          <main id="main-content" className="flex-1 min-w-0 p-6" tabIndex={-1}>
            <Outlet />
          </main>
        </div>

        {/* トースト通知 */}
        <ToastContainer />

        {/* コマンドパレット (⌘+K) */}
        <CommandPalette />
      </div>
    </PageSidebarContext.Provider>
  );
}
