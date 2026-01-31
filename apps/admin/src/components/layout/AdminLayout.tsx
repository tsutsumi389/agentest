import { useState } from 'react';
import { Outlet } from 'react-router';
import { AdminHeader } from './AdminHeader';
import { AdminSlideoverMenu } from './AdminSlideoverMenu';

/**
 * 管理画面レイアウト
 * ヘッダーとスライドオーバーメニューを含む共通レイアウト
 */
export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader onMenuClick={() => setMenuOpen(true)} />
      <AdminSlideoverMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* ヘッダーの高さ（h-16 = 64px）分のパディング */}
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
}
