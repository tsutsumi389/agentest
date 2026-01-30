import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { FolderKanban, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { usersApi } from '../lib/api';

/**
 * ダッシュボードページ
 */
export function DashboardPage() {
  const { user } = useAuthStore();

  // プロジェクト一覧を取得
  const { data: projectsData, isLoading, isError } = useQuery({
    queryKey: ['user-projects', user?.id],
    queryFn: () => usersApi.getProjects(user!.id),
    enabled: !!user?.id,
  });

  const projects = projectsData?.projects || [];

  return (
    <div className="space-y-6">
      {/* エラー表示 */}
      {isError && (
        <div className="card p-4 border-danger/30 bg-danger-subtle/10">
          <p className="text-sm text-danger">
            プロジェクト一覧の取得に失敗しました。ページを再読み込みしてください。
          </p>
        </div>
      )}

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
                  <div className="w-10 h-10 rounded bg-accent-subtle flex items-center justify-center">
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
    </div>
  );
}
