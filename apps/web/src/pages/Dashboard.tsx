import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  FolderKanban,
  FileText,
  Play,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { usersApi } from '../lib/api';

/**
 * ダッシュボードページ
 */
export function DashboardPage() {
  const { user } = useAuthStore();

  // プロジェクト一覧を取得
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['user-projects', user?.id],
    queryFn: () => usersApi.getProjects(user!.id),
    enabled: !!user?.id,
  });

  const projects = projectsData?.projects || [];

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          おかえりなさい、{user?.name}
        </h1>
        <p className="text-foreground-muted mt-1">
          プロジェクトの状況を確認しましょう
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FolderKanban}
          label="プロジェクト"
          value={projects.length}
          color="accent"
        />
        <StatCard
          icon={FileText}
          label="テストスイート"
          value={projects.reduce((acc, p) => acc + (p._count?.testSuites || 0), 0)}
          color="accent"
        />
        <StatCard
          icon={CheckCircle2}
          label="成功"
          value="-"
          color="success"
        />
        <StatCard
          icon={XCircle}
          label="失敗"
          value="-"
          color="danger"
        />
      </div>

      {/* 最近のプロジェクト */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">最近のプロジェクト</h2>
          <Link
            to="/projects"
            className="text-sm text-accent hover:text-accent-hover flex items-center gap-1"
          >
            すべて表示
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-foreground-muted">
            読み込み中...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center">
            <FolderKanban className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
            <p className="text-foreground-muted mb-4">
              プロジェクトがありません
            </p>
            <Link to="/projects" className="btn btn-primary">
              プロジェクトを作成
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between p-4 hover:bg-background-tertiary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-accent-muted flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{project.name}</p>
                    <p className="text-sm text-foreground-muted">
                      {project._count?.testSuites || 0} テストスイート
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-foreground-subtle" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 最近の実行（プレースホルダー） */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">最近の実行</h2>
        </div>
        <div className="p-8 text-center">
          <Play className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
          <p className="text-foreground-muted">
            最近の実行はありません
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 統計カードコンポーネント
 */
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: 'accent' | 'success' | 'danger';
}) {
  const colorClasses = {
    accent: 'bg-accent-muted text-accent',
    success: 'bg-success-muted text-success',
    danger: 'bg-danger-muted text-danger',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
