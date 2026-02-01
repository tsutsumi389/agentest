import { LayoutDashboard, Users, Building2, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * ナビゲーションリンク定義
 */
export interface NavLink {
  to: string;
  label: string;
  icon: LucideIcon;
  /** trueの場合、パスが完全一致の場合のみアクティブ */
  exact?: boolean;
}

/**
 * 管理画面のナビゲーションリンク
 */
export const adminNavLinks: NavLink[] = [
  { to: '/', label: 'ダッシュボード', icon: LayoutDashboard, exact: true },
  { to: '/users', label: 'ユーザー', icon: Users },
  { to: '/organizations', label: '組織', icon: Building2 },
  { to: '/audit-logs', label: '監査ログ', icon: ClipboardList },
];

/**
 * 現在のパスがナビゲーションリンクにマッチするか判定
 */
export function isNavLinkActive(link: NavLink, pathname: string): boolean {
  if (link.exact) {
    return pathname === link.to;
  }
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}
