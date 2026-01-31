import { useState, useCallback } from 'react';
import { Outlet } from 'react-router';
import { AdminHeader } from './AdminHeader';
import { AdminSlideoverMenu } from './AdminSlideoverMenu';

/**
 * 管理画面レイアウト
 * ヘッダーとスライドオーバーメニューを含む共通レイアウト
 */
export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  // コールバックをメモ化して不要な再レンダリングを防止
  const handleMenuOpen = useCallback(() => setMenuOpen(true), []);
  const handleMenuClose = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader onMenuClick={handleMenuOpen} />
      <AdminSlideoverMenu isOpen={menuOpen} onClose={handleMenuClose} />
      {/* ヘッダーの高さ（h-16 = 64px）分のパディング */}
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
}
