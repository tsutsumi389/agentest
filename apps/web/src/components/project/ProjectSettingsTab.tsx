import { Settings, Users, Server, History, AlertTriangle } from 'lucide-react';
import type { Project, ProjectMemberRole } from '../../lib/api';
import { ProjectGeneralSettings } from './ProjectGeneralSettings';
import { ProjectMemberList } from './ProjectMemberList';
import { EnvironmentList } from './EnvironmentList';
import { HistoryList } from './HistoryList';
import { DeleteProjectSection } from './DeleteProjectSection';

export type SettingsSection = 'general' | 'members' | 'environments' | 'history' | 'danger';

interface ProjectSettingsTabProps {
  project: Project;
  currentRole?: 'OWNER' | ProjectMemberRole;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onProjectUpdated: (project: Project) => void;
  deletedAt?: string | null;
}

/**
 * プロジェクト設定タブ
 * 左サイドナビゲーションと各セクションのコンテンツを表示
 */
export function ProjectSettingsTab({
  project,
  currentRole,
  activeSection,
  onSectionChange,
  onProjectUpdated,
  deletedAt,
}: ProjectSettingsTabProps) {
  // タブ定義
  const tabs = [
    { id: 'general' as const, label: '一般', icon: Settings },
    { id: 'members' as const, label: 'メンバー', icon: Users },
    { id: 'environments' as const, label: '環境', icon: Server },
    { id: 'history' as const, label: '履歴', icon: History },
    { id: 'danger' as const, label: '危険な操作', icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* タブナビゲーション */}
      <nav className="lg:w-48 flex-shrink-0">
        <ul className="space-y-1">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => onSectionChange(tab.id)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded transition-colors
                  ${activeSection === tab.id
                    ? 'bg-accent-subtle text-accent'
                    : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                  }
                  ${tab.id === 'danger' ? 'text-danger hover:text-danger' : ''}
                `}
              >
                <tab.icon className={`w-4 h-4 ${tab.id === 'danger' && activeSection !== tab.id ? 'text-danger' : ''}`} />
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* コンテンツ */}
      <div className="flex-1">
        {activeSection === 'general' && (
          <ProjectGeneralSettings
            project={project}
            onUpdated={onProjectUpdated}
          />
        )}
        {activeSection === 'members' && (
          <ProjectMemberList
            project={project}
            currentRole={currentRole}
          />
        )}
        {activeSection === 'environments' && (
          <EnvironmentList
            project={project}
            currentRole={currentRole}
          />
        )}
        {activeSection === 'history' && (
          <HistoryList project={project} />
        )}
        {activeSection === 'danger' && (
          <DeleteProjectSection
            project={project}
            deletedAt={deletedAt}
            onUpdated={onProjectUpdated}
          />
        )}
      </div>
    </div>
  );
}
