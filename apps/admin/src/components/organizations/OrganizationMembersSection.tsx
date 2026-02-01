import { Link } from 'react-router';
import type { AdminOrganizationMember } from '@agentest/shared/types';
import { formatDate } from '../../lib/date-utils';

interface OrganizationMembersSectionProps {
  members: AdminOrganizationMember[];
}

/**
 * 役割バッジ
 */
function RoleBadge({ role }: { role: AdminOrganizationMember['role'] }) {
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
 * メンバー一覧セクション
 */
export function OrganizationMembersSection({ members }: OrganizationMembersSectionProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">
          メンバー一覧（最新20件）
        </h2>
      </div>
      {members.length === 0 ? (
        <div className="px-4 py-8 text-center text-foreground-muted">
          メンバーはいません
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  ユーザー
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
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-border last:border-b-0 hover:bg-background-tertiary"
                >
                  {/* ユーザー情報 */}
                  <td className="px-4 py-3">
                    <Link
                      to={`/users/${member.userId}`}
                      className="flex items-center gap-3 hover:opacity-80"
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center">
                          <span className="text-sm font-medium text-accent">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {member.name}
                        </div>
                        <div className="text-xs text-foreground-muted">
                          {member.email}
                        </div>
                      </div>
                    </Link>
                  </td>

                  {/* 役割 */}
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>

                  {/* 参加日 */}
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {formatDate(member.joinedAt)}
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
