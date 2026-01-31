import { Users, FolderKanban, FileCheck, Play } from 'lucide-react';
import type { AdminOrganizationDetailStats } from '@agentest/shared';

interface OrganizationStatsSectionProps {
  stats: AdminOrganizationDetailStats;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

/**
 * 統計カード
 */
function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-sm text-foreground-muted">{label}</p>
          <p className="text-xl font-bold text-foreground">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * 組織統計セクション
 */
export function OrganizationStatsSection({ stats }: OrganizationStatsSectionProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-foreground-muted">統計</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-foreground-muted" />}
          label="メンバー数"
          value={stats.memberCount}
        />
        <StatCard
          icon={<FolderKanban className="w-5 h-5 text-foreground-muted" />}
          label="プロジェクト数"
          value={stats.projectCount}
        />
        <StatCard
          icon={<FileCheck className="w-5 h-5 text-foreground-muted" />}
          label="テストスイート"
          value={stats.testSuiteCount}
        />
        <StatCard
          icon={<Play className="w-5 h-5 text-foreground-muted" />}
          label="テスト実行"
          value={stats.executionCount}
        />
      </div>
    </div>
  );
}
