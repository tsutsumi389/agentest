import { Link } from 'react-router';
import { Play, Plus, Pencil, ChevronRight, FileText, History, MessageSquare, Settings } from 'lucide-react';
import type { TestSuite, Project, ProjectMemberRole } from '../../lib/api';

/**
 * タブ定義
 */
export type TabType = 'overview' | 'executions' | 'review' | 'history' | 'settings';

const TABS: { id: TabType; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'executions', label: '実行履歴', icon: Play },
  { id: 'review', label: 'レビュー', icon: MessageSquare },
  { id: 'history', label: '変更履歴', icon: History },
  { id: 'settings', label: '設定', icon: Settings },
];

interface TestSuiteHeaderProps {
  testSuite: TestSuite;
  project?: Project;
  testCaseCount: number;
  currentRole?: 'OWNER' | ProjectMemberRole;
  onStartExecution: () => void;
  onCreateTestCase: () => void;
  onEdit?: () => void;
  isExecutionPending?: boolean;
  // タブ関連のprops
  currentTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  // テストケース選択状態（タブのハイライト解除用）
  hasSelectedTestCase?: boolean;
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
  currentTab = 'overview',
  onTabChange,
  hasSelectedTestCase = false,
}: TestSuiteHeaderProps) {
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
            to={`/test-suites/${testSuite.id}`}
            className="text-accent hover:text-accent-hover hover:underline font-medium"
          >
            {testSuite.name}
          </Link>
        </div>
      </div>

      {/* ナビゲーションとアクション */}
      <div className="px-4 pb-0 flex items-center justify-between">
        {/* サブタブナビゲーション */}
        <nav className="-mb-px flex gap-4" aria-label="タブ">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            // テストケース選択中はタブのハイライトを解除
            const isActive = !hasSelectedTestCase && currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={`
                  flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors
                  ${
                    isActive
                      ? 'border-accent text-accent'
                      : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* アクションボタン */}
        <div className="flex items-center gap-2 pb-2">
          {canEdit && onEdit && (
            <button
              onClick={onEdit}
              className="btn btn-secondary btn-sm"
              title="テストスイートを編集"
            >
              <Pencil className="w-4 h-4" />
              編集
            </button>
          )}
          {canEdit && (
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
