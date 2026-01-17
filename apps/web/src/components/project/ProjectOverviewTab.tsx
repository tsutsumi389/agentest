/**
 * プロジェクト概要タブ
 * テスト状況のサマリーを表示（別タスクで本実装予定）
 */
interface ProjectOverviewTabProps {
  projectId: string;
}

export function ProjectOverviewTab({ projectId: _projectId }: ProjectOverviewTabProps) {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">テスト状況</h2>
      <p className="text-foreground-muted">
        プロジェクトのテスト状況がここに表示されます。
      </p>
      {/* サンプル: 後で実装 */}
    </div>
  );
}
