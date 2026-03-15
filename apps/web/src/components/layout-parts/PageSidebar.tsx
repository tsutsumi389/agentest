import type { ReactNode } from 'react';

interface PageSidebarProps {
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

/**
 * ページ固有のサイドバー
 * 各ページで独自のコンテンツを表示するためのサイドバー
 */
export function PageSidebar({ children, width = 'md' }: PageSidebarProps) {
  const widthClasses = {
    sm: 'w-56',
    md: 'w-64',
    lg: 'w-80',
  };

  return (
    <aside
      className={`hidden lg:block ${widthClasses[width]} flex-shrink-0 bg-background-secondary border-r border-border overflow-y-auto`}
    >
      {children}
    </aside>
  );
}

/**
 * サイドバーセクション
 */
export function SidebarSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="p-4">
      {title && (
        <h3 className="px-2 py-1 text-xs font-medium text-foreground-muted uppercase tracking-wider mb-2">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/**
 * サイドバーアイテム
 */
export function SidebarItem({
  children,
  isActive,
  onClick,
}: {
  children: ReactNode;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left ${
        isActive
          ? 'bg-accent-subtle text-accent'
          : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
      }`}
    >
      {children}
    </button>
  );
}
