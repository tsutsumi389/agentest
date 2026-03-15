import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router';

/**
 * パンくずアイテムの型定義
 */
export interface BreadcrumbItem {
  /** 表示ラベル */
  label: string;
  /** リンク先（省略時は現在のページ） */
  href?: string;
  /** アイコン */
  icon?: React.ElementType;
}

interface BreadcrumbProps {
  /** パンくずアイテムの配列 */
  items: BreadcrumbItem[];
  /** ホームリンクを表示するか */
  showHome?: boolean;
  /** カスタムクラス */
  className?: string;
}

/**
 * パンくずリストコンポーネント
 * ナビゲーション階層を表示
 */
export function Breadcrumb({ items, showHome = true, className = '' }: BreadcrumbProps) {
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'ホーム', href: '/dashboard', icon: Home }, ...items]
    : items;

  return (
    <nav aria-label="パンくずリスト" className={`flex items-center gap-1 text-sm ${className}`}>
      <ol className="flex items-center gap-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const Icon = item.icon;

          return (
            <li key={index} className="flex items-center gap-1">
              {/* セパレーター */}
              {index > 0 && (
                <ChevronRight
                  className="w-4 h-4 text-foreground-subtle flex-shrink-0"
                  aria-hidden="true"
                />
              )}

              {/* リンクまたはテキスト */}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors"
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className="flex items-center gap-1 text-foreground"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
