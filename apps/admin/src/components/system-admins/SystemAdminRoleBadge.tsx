import type { SystemAdminRole } from '@agentest/shared/types';

interface SystemAdminRoleBadgeProps {
  role: SystemAdminRole;
}

/**
 * ロール表示用のバッジスタイル
 */
const roleStyles: Record<SystemAdminRole, string> = {
  SUPER_ADMIN: 'bg-error/10 text-error border-error/30',
  ADMIN: 'bg-accent/10 text-accent border-accent/30',
  VIEWER: 'bg-foreground-muted/10 text-foreground-muted border-foreground-muted/30',
};

/**
 * ロール表示ラベル
 */
const roleLabels: Record<SystemAdminRole, string> = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  VIEWER: 'VIEWER',
};

/**
 * システム管理者ロールバッジ
 */
export function SystemAdminRoleBadge({ role }: SystemAdminRoleBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${roleStyles[role]}`}
    >
      {roleLabels[role]}
    </span>
  );
}
