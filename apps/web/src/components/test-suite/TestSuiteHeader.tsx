import { Link } from 'react-router';
import { Play, Plus, Pencil, ChevronRight, FileText, History, MessageSquare, Settings, Copy, X } from 'lucide-react';
import type { TestSuite, Project, ProjectMemberRole } from '../../lib/api';
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS } from '../../lib/constants';

/**
 * テストスイート用タブ定義
 */
export type TabType = 'overview' | 'executions' | 'review' | 'history' | 'settings';

const TABS: { id: TabType; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'executions', label: '実行履歴', icon: Play },
  { id: 'review', label: 'レビュー', icon: MessageSquare },
  { id: 'history', label: '変更履歴', icon: History },
  { id: 'settings', label: '設定', icon: Settings },
];

/**
 * テストケース用タブ定義
 */
export type TestCaseTabType = 'overview' | 'history' | 'settings';

const TEST_CASE_TABS: { id: TestCaseTabType; label: string; icon: typeof FileText }[] = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'history', label: '履歴', icon: History },
  { id: 'settings', label: '設定', icon: Settings },
];

/**
 * テストケース選択時の情報
 */
interface SelectedTestCaseInfo {
  id: string;
  title: string;
  priority: string;
  status: string;
  deletedAt?: string | null;
}

interface TestSuiteHeaderProps {
  testSuite: TestSuite;
  project?: Project;
  testCaseCount: number;
  currentRole?: 'OWNER' | ProjectMemberRole;
  onStartExecution: () => void;
  onCreateTestCase: () => void;
  onEdit?: () => void;
  isExecutionPending?: boolean;
  // テストスイートタブ関連のprops
  currentTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  // テストケース選択状態（タブのハイライト解除用）
  hasSelectedTestCase?: boolean;
  // 作成モード（タブとアクションボタンを非表示にする）
  isCreateMode?: boolean;
  // テストケース選択時の情報
  selectedTestCase?: SelectedTestCaseInfo;
  testCaseTab?: TestCaseTabType;
  onTestCaseTabChange?: (tab: TestCaseTabType) => void;
  onEditTestCase?: () => void;
  onCopyTestCase?: () => void;
  onCloseTestCase?: () => void;
}

/**
 * テストスイートヘッダーコンポーネント（GitHub風）
 * パンくずリスト、ナビゲーションタブ、アクションボタンを含む
 * テストケース選択時は表示が切り替わる
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
  isCreateMode = false,
  // テストケース選択時のprops
  selectedTestCase,
  testCaseTab = 'overview',
  onTestCaseTabChange,
  onEditTestCase,
  onCopyTestCase,
  onCloseTestCase,
}: TestSuiteHeaderProps) {
  // 編集権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  // テストケース選択中かどうか
  const isTestCaseMode = !!selectedTestCase;

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
          {isTestCaseMode ? (
            // テストケース選択時: テストスイート名はリンク、テストケース名を追加
            <>
              <Link
                to={`/test-suites/${testSuite.id}`}
                className="text-accent hover:text-accent-hover hover:underline"
              >
                {testSuite.name}
              </Link>
              <ChevronRight className="w-4 h-4 text-foreground-muted" />
              <span className="text-foreground font-medium truncate max-w-[200px]">
                {selectedTestCase.title}
              </span>
              {/* 優先度バッジ */}
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[selectedTestCase.priority]}`}>
                {PRIORITY_LABELS[selectedTestCase.priority]}
              </span>
              {/* ステータスバッジ */}
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[selectedTestCase.status]}`}>
                {STATUS_LABELS[selectedTestCase.status]}
              </span>
              {/* 削除予定バッジ */}
              {selectedTestCase.deletedAt && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-danger/20 text-danger">
                  削除予定
                </span>
              )}
            </>
          ) : (
            // テストスイート表示時
            <Link
              to={`/test-suites/${testSuite.id}`}
              className="text-accent hover:text-accent-hover hover:underline font-medium"
            >
              {testSuite.name}
            </Link>
          )}
        </div>
      </div>

      {/* ナビゲーションとアクション（作成モード時は非表示） */}
      {!isCreateMode && (
      <div className="px-4 pb-0 flex items-center justify-between">
        {isTestCaseMode ? (
          // テストケース選択時: テストケース用タブ
          <nav className="-mb-px flex gap-4" aria-label="タブ">
            {TEST_CASE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = testCaseTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTestCaseTabChange?.(tab.id)}
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
        ) : (
          // テストスイート表示時: テストスイート用タブ
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
        )}

        {/* アクションボタン */}
        <div className="flex items-center gap-2 pb-2">
          {isTestCaseMode ? (
            // テストケース選択時: 編集/コピー/閉じる
            <>
              {canEdit && onEditTestCase && (
                <button
                  onClick={onEditTestCase}
                  className="btn btn-secondary btn-sm"
                  title="テストケースを編集"
                >
                  <Pencil className="w-4 h-4" />
                  編集
                </button>
              )}
              {canEdit && onCopyTestCase && (
                <button
                  onClick={onCopyTestCase}
                  className="btn btn-secondary btn-sm"
                  title="テストケースをコピー"
                >
                  <Copy className="w-4 h-4" />
                  コピー
                </button>
              )}
              {onCloseTestCase && (
                <button
                  onClick={onCloseTestCase}
                  className="btn btn-secondary btn-sm"
                  title="閉じる"
                >
                  <X className="w-4 h-4" />
                  閉じる
                </button>
              )}
            </>
          ) : (
            // テストスイート表示時: 編集/+テストケース/実行開始
            <>
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
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
