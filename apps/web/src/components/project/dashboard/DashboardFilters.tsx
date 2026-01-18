import { LabelSelector } from '../../label/LabelSelector';
import type { Label, ProjectEnvironment } from '../../../lib/api';

interface DashboardFiltersProps {
  /** 利用可能な環境一覧 */
  environments: ProjectEnvironment[];
  /** 選択中の環境ID */
  selectedEnvironmentId: string | undefined;
  /** 環境変更時のコールバック */
  onEnvironmentChange: (environmentId: string | undefined) => void;
  /** 利用可能なラベル一覧 */
  labels: Label[];
  /** 選択中のラベルID一覧 */
  selectedLabelIds: string[];
  /** ラベル変更時のコールバック */
  onLabelChange: (labelIds: string[]) => void;
}

/**
 * ダッシュボードフィルターコンポーネント
 * 環境とラベルでフィルタリング
 */
export function DashboardFilters({
  environments,
  selectedEnvironmentId,
  onEnvironmentChange,
  labels,
  selectedLabelIds,
  onLabelChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* 環境フィルター */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-foreground-muted whitespace-nowrap">環境:</label>
        <select
          value={selectedEnvironmentId ?? ''}
          onChange={(e) => onEnvironmentChange(e.target.value || undefined)}
          className="px-3 py-1.5 text-sm bg-background border border-border rounded hover:border-foreground-subtle focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">すべて</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
      </div>

      {/* ラベルフィルター */}
      <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[400px]">
        <label className="text-sm text-foreground-muted whitespace-nowrap">ラベル:</label>
        <LabelSelector
          availableLabels={labels}
          selectedLabelIds={selectedLabelIds}
          onChange={onLabelChange}
          placeholder="すべて"
          className="flex-1"
        />
      </div>
    </div>
  );
}
