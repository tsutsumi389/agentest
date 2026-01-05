import { Link, useLocation } from 'react-router';
import { Play, Plus, Pencil, ChevronRight } from 'lucide-react';
import type { TestSuite, Project, ProjectMemberRole } from '../../lib/api';

interface TestSuiteHeaderProps {
  testSuite: TestSuite;
  project?: Project;
  testCaseCount: number;
  currentRole?: 'OWNER' | ProjectMemberRole;
  onStartExecution: () => void;
  onCreateTestCase: () => void;
  onEdit?: () => void;
  isExecutionPending?: boolean;
}

/**
 * テストスイートヘッダーコンポーネント（GitHub風）
 * パンくずリスト、ナビゲーションタブ、アクションボタンを含む
 */
export function TestSuiteHeader({
  testSuite,
  project,
  testCaseCount,
  currentRole,
  onStartExecution,
  onCreateTestCase,
  onEdit,
  isExecutionPending = false,
}: TestSuiteHeaderProps) {
  const location = useLocation();

  // 現在のパスがinfoページかどうか判定
  const isInfoPage = location.pathname.endsWith('/info');

  // 編集権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  return (
    <div className="border-b border-border bg-background-secondary">
      {/* パンくずリスト（GitHub風） */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Link
            to={`/projects/${testSuite.projectId}`}
            className="text-accent hover:text-accent-hover hover:underline"
          >
            {project?.name || 'プロジェクト'}
          </Link>
          <ChevronRight className="w-4 h-4 text-foreground-muted" />
          <Link
            to={`/test-suites/${testSuite.id}/info`}
            className="text-accent hover:text-accent-hover hover:underline font-medium"
          >
            {testSuite.name}
          </Link>
        </div>
      </div>

      {/* ナビゲーションとアクション */}
      <div className="px-4 pb-0 flex items-center justify-between">
        {/* ナビゲーションタブ */}
        <nav className="-mb-px flex gap-4" aria-label="タブ">
          <Link
            to={`/test-suites/${testSuite.id}`}
            className={`
              flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors
              ${
                !isInfoPage
                  ? 'border-accent text-accent'
                  : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border'
              }
            `}
          >
            テストケース
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-background-tertiary">
              {testCaseCount}
            </span>
          </Link>
          <Link
            to={`/test-suites/${testSuite.id}/info`}
            className={`
              flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors
              ${
                isInfoPage
                  ? 'border-accent text-accent'
                  : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border'
              }
            `}
          >
            詳細情報
          </Link>
        </nav>

        {/* アクションボタン */}
        <div className="flex items-center gap-2 pb-2">
          {canEdit && onEdit && !isInfoPage && (
            <button
              onClick={onEdit}
              className="btn btn-secondary btn-sm"
              title="テストスイートを編集"
            >
              <Pencil className="w-4 h-4" />
              編集
            </button>
          )}
          {canEdit && !isInfoPage && (
            <button
              onClick={onCreateTestCase}
              className="btn btn-secondary btn-sm"
            >
              <Plus className="w-4 h-4" />
              テストケース
            </button>
          )}
          <button
            onClick={onStartExecution}
            disabled={isExecutionPending || testCaseCount === 0}
            className="btn btn-primary btn-sm"
          >
            <Play className="w-4 h-4" />
            実行開始
          </button>
        </div>
      </div>
    </div>
  );
}
