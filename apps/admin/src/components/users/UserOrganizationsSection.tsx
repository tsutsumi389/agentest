import type { AdminUserOrganization } from '@agentest/shared';

interface UserOrganizationsSectionProps {
  organizations: AdminUserOrganization[];
}

/**
 * 役割バッジ
 */
function RoleBadge({ role }: { role: AdminUserOrganization['role'] }) {
  const styles = {
    OWNER: 'bg-accent-muted text-accent',
    ADMIN: 'bg-warning/20 text-warning',
    MEMBER: 'bg-background-tertiary text-foreground-muted',
  };

  const labels = {
    OWNER: 'オーナー',
    ADMIN: '管理者',
    MEMBER: 'メンバー',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[role]}`}>
      {labels[role]}
    </span>
  );
}

/**
 * 日付フォーマット
 */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * 所属組織セクション
 */
export function UserOrganizationsSection({
  organizations,
}: UserOrganizationsSectionProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">
          所属組織（{organizations.length}）
        </h2>
      </div>
      {organizations.length === 0 ? (
        <div className="px-4 py-8 text-center text-foreground-muted">
          所属している組織はありません
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  組織名
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  役割
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  参加日
                </th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-border last:border-b-0 hover:bg-background-tertiary"
                >
                  <td className="px-4 py-3 text-sm text-foreground">
                    {org.name}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={org.role} />
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {formatDate(org.joinedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
