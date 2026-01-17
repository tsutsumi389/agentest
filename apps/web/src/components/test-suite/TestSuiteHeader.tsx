import { Play, Pencil, FileText, History, MessageSquare, Settings, Copy, X } from 'lucide-react';
import type { TestSuite, ProjectMemberRole } from '../../lib/api';
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
  testCaseCount: number;
  currentRole?: 'OWNER' | ProjectMemberRole;
  onStartExecution: () => void;
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
 * タイトル、ナビゲーションタブ、アクションボタンを含む
 * テストケース選択時は表示が切り替わる
 */
export function TestSuiteHeader({
  testSuite,
  testCaseCount,
  currentRole,
  onStartExecution,
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
      {/* ヘッダー1行目: タイトル + アクションボタン */}
      <div className="px-4 py-3">
        {isTestCaseMode ? (
          // テストケース選択時: タイトル + アクションボタン（テストスイートと同じ構造）
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground truncate max-w-[300px]">
                {selectedTestCase.title}
              </h1>
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
            </div>
            {/* アクションボタン */}
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        ) : (
          // テストスイート表示時: タイトル + アクションボタン
          <div className="flex items-center justify-between">
            {/* テストスイート名（ページタイトル） */}
            <h1 className="text-lg font-semibold text-foreground">
              {testSuite.name}
            </h1>
            {/* アクションボタン（作成モード時は非表示） */}
            {!isCreateMode && (
              <div className="flex items-center gap-2">
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
                <button
                  onClick={onStartExecution}
                  disabled={isExecutionPending || testCaseCount === 0}
                  className="btn btn-primary btn-sm"
                >
                  <Play className="w-4 h-4" />
                  実行開始
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ナビゲーションタブ（作成モード時は非表示） */}
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
      </div>
      )}
    </div>
  );
}
