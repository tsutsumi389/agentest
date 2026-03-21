import { Settings, Users, Server, History, AlertTriangle, Tags } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project, ProjectMemberRole } from '../../lib/api';
import { labelsApi } from '../../lib/api';
import { ProjectGeneralSettings } from './ProjectGeneralSettings';
import { ProjectMemberList } from './ProjectMemberList';
import { EnvironmentList } from './EnvironmentList';
import { HistoryList } from './HistoryList';
import { DeleteProjectSection } from './DeleteProjectSection';
import { LabelList } from '../label/LabelList';
import { toast } from '../../stores/toast';
import { hasWritePermission } from '../../lib/permissions';

export type SettingsSection =
  | 'general'
  | 'members'
  | 'environments'
  | 'labels'
  | 'history'
  | 'danger';

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
    { id: 'labels' as const, label: 'ラベル', icon: Tags },
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
                  ${
                    activeSection === tab.id
                      ? tab.id === 'danger'
                        ? 'bg-danger-subtle text-danger'
                        : 'bg-accent-subtle text-accent'
                      : tab.id === 'danger'
                        ? 'text-danger hover:text-danger hover:bg-background-tertiary'
                        : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* コンテンツ */}
      <div className="flex-1">
        {activeSection === 'general' && (
          <ProjectGeneralSettings project={project} onUpdated={onProjectUpdated} />
        )}
        {activeSection === 'members' && (
          <ProjectMemberList project={project} currentRole={currentRole} />
        )}
        {activeSection === 'environments' && (
          <EnvironmentList project={project} currentRole={currentRole} />
        )}
        {activeSection === 'labels' && (
          <LabelManagementSection project={project} currentRole={currentRole} />
        )}
        {activeSection === 'history' && <HistoryList project={project} />}
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

/**
 * ラベル管理セクション
 */
interface LabelManagementSectionProps {
  project: Project;
  currentRole?: 'OWNER' | ProjectMemberRole;
}

function LabelManagementSection({ project, currentRole }: LabelManagementSectionProps) {
  const queryClient = useQueryClient();

  // 編集権限の判定
  const canEdit = hasWritePermission(currentRole);
  const canDelete = currentRole === 'OWNER' || currentRole === 'ADMIN';

  // ラベル一覧を取得
  const { data: labelsData, isLoading } = useQuery({
    queryKey: ['project-labels', project.id],
    queryFn: () => labelsApi.getByProject(project.id),
  });

  const labels = labelsData?.labels || [];

  // ラベル作成
  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; color: string }) =>
      labelsApi.create(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', project.id] });
      toast.success('ラベルを作成しました');
    },
    onError: (error) => {
      console.error('ラベル作成エラー:', error);
      toast.error('ラベルの作成に失敗しました');
    },
  });

  // ラベル更新
  const updateMutation = useMutation({
    mutationFn: ({
      labelId,
      data,
    }: {
      labelId: string;
      data: { name: string; description: string | null; color: string };
    }) => labelsApi.update(project.id, labelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', project.id] });
      toast.success('ラベルを更新しました');
    },
    onError: (error) => {
      console.error('ラベル更新エラー:', error);
      toast.error('ラベルの更新に失敗しました');
    },
  });

  // ラベル削除
  const deleteMutation = useMutation({
    mutationFn: (labelId: string) => labelsApi.delete(project.id, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-labels', project.id] });
      toast.success('ラベルを削除しました');
    },
    onError: (error) => {
      console.error('ラベル削除エラー:', error);
      toast.error('ラベルの削除に失敗しました');
    },
  });

  return (
    <LabelList
      labels={labels}
      isLoading={isLoading}
      canEdit={canEdit}
      canDelete={canDelete}
      onCreate={async (data) => {
        await createMutation.mutateAsync(data);
      }}
      onUpdate={async (labelId, data) => {
        await updateMutation.mutateAsync({ labelId, data });
      }}
      onDelete={async (labelId) => {
        await deleteMutation.mutateAsync(labelId);
      }}
    />
  );
}
