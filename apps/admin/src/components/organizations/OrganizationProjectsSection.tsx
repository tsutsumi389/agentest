import { Users, FileCheck } from 'lucide-react';
import type { AdminOrganizationProject } from '@agentest/shared/types';
import { formatDate } from '../../lib/date-utils';

interface OrganizationProjectsSectionProps {
  projects: AdminOrganizationProject[];
}

/**
 * プロジェクト一覧セクション
 */
export function OrganizationProjectsSection({ projects }: OrganizationProjectsSectionProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">
          プロジェクト一覧（最新10件）
        </h2>
      </div>
      {projects.length === 0 ? (
        <div className="px-4 py-8 text-center text-foreground-muted">
          プロジェクトはありません
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  プロジェクト名
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  統計
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  作成日
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-border last:border-b-0 hover:bg-background-tertiary"
                >
                  {/* プロジェクト名 */}
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {project.name}
                      </div>
                      {project.description && (
                        <div className="text-xs text-foreground-muted truncate max-w-xs">
                          {project.description}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 統計 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4 text-sm text-foreground-muted">
                      <div className="flex items-center gap-1" title="メンバー数">
                        <Users className="w-4 h-4" />
                        <span>{project.memberCount}</span>
                      </div>
                      <div className="flex items-center gap-1" title="テストスイート数">
                        <FileCheck className="w-4 h-4" />
                        <span>{project.testSuiteCount}</span>
                      </div>
                    </div>
                  </td>

                  {/* 作成日 */}
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {formatDate(project.createdAt)}
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
