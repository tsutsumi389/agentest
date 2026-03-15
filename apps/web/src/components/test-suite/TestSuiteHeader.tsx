import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pencil,
  FileText,
  History,
  MessageSquare,
  Settings,
  Copy,
  MoreVertical,
  Archive,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { TestSuite, ProjectMemberRole, Label } from '../../lib/api';
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../../lib/constants';
import { LabelBadgeList } from '../ui/LabelBadge';
import { Breadcrumb, type BreadcrumbItem } from '../ui/Breadcrumb';

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
  // ステータス変更
  onStatusChange?: (status: 'ACTIVE' | 'ARCHIVED') => void;
  isStatusChangePending?: boolean;
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
  // ステータス遷移: DRAFT -> ACTIVE, ACTIVE <-> ARCHIVED（DRAFTへの戻しはサポートしない）
  onTestCaseStatusChange?: (status: 'ACTIVE' | 'ARCHIVED') => void;
  isTestCaseStatusChangePending?: boolean;
  // ラベル
  labels?: Label[];
  // パンくずリスト用プロジェクト情報
  projectId?: string;
  projectName?: string;
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
  onStatusChange,
  isStatusChangePending = false,
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
  onTestCaseStatusChange,
  isTestCaseStatusChangePending = false,
  // ラベル
  labels,
  // パンくずリスト用プロジェクト情報
  projectId,
  projectName,
}: TestSuiteHeaderProps) {
  // 編集権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  // テストケース選択中かどうか
  const isTestCaseMode = !!selectedTestCase;

  // パンくずリストアイテムを構築
  const breadcrumbItems: BreadcrumbItem[] | null = (() => {
    if (!projectId || !projectName) return null;
    const items: BreadcrumbItem[] = [
      { label: projectName, href: `/projects/${projectId}?tab=suites` },
    ];
    if (selectedTestCase) {
      // テストケース選択時: プロジェクト > テストスイート（リンク） > テストケース
      items.push({ label: testSuite.name, href: `/test-suites/${testSuite.id}` });
      items.push({ label: selectedTestCase.title });
    } else {
      // テストスイート表示時: プロジェクト > テストスイート
      items.push({ label: testSuite.name });
    }
    return items;
  })();

  return (
    <div className="border-b border-border bg-background-secondary">
      {/* パンくずリスト + 3点リーダーメニュー */}
      {breadcrumbItems && (
        <div className="px-4 pt-3 pb-0 flex items-center justify-between">
          <Breadcrumb items={breadcrumbItems} showHome={false} />
          {/* 3点リーダーメニュー（作成モード以外） */}
          {!isCreateMode &&
            (isTestCaseMode ? (
              <TestCaseActionMenu
                canEdit={canEdit}
                onEdit={onEditTestCase}
                onCopy={onCopyTestCase}
                testCaseStatus={selectedTestCase.status}
                onStatusChange={onTestCaseStatusChange}
                isStatusChangePending={isTestCaseStatusChangePending}
              />
            ) : (
              <TestSuiteActionMenu
                canEdit={canEdit}
                onEdit={onEdit}
                onStartExecution={onStartExecution}
                isExecutionDisabled={isExecutionPending || testCaseCount === 0}
                suiteStatus={testSuite.status}
                onStatusChange={onStatusChange}
                isStatusChangePending={isStatusChangePending}
              />
            ))}
        </div>
      )}

      {/* ヘッダー1行目: タイトル */}
      <div className="px-4 py-3">
        {isTestCaseMode ? (
          // テストケース選択時: タイトル + バッジ
          <div className="flex items-center gap-2">
            {/* 優先度バッジ */}
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[selectedTestCase.priority]}`}
            >
              {PRIORITY_LABELS[selectedTestCase.priority]}
            </span>
            <h1
              className="text-lg font-semibold text-foreground truncate max-w-[300px]"
              title={selectedTestCase.title}
            >
              {selectedTestCase.title}
            </h1>
            {/* ステータスバッジ（アクティブは通常状態のため非表示） */}
            {selectedTestCase.status !== 'ACTIVE' && (
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[selectedTestCase.status]}`}
              >
                {STATUS_LABELS[selectedTestCase.status]}
              </span>
            )}
            {/* 削除予定バッジ */}
            {selectedTestCase.deletedAt && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-danger/20 text-danger">
                削除予定
              </span>
            )}
          </div>
        ) : (
          // テストスイート表示時: タイトル + ステータスバッジ + ラベル
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">{testSuite.name}</h1>
            {/* ステータスバッジ（ARCHIVED時のみ表示） */}
            {testSuite.status === 'ARCHIVED' && (
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[testSuite.status]}`}
              >
                {STATUS_LABELS[testSuite.status]}
              </span>
            )}
            {/* ラベルバッジ */}
            {labels && labels.length > 0 && <LabelBadgeList labels={labels} emptyText="" />}
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

/**
 * テストスイートの3点リーダーアクションメニュー
 */
interface TestSuiteActionMenuProps {
  canEdit: boolean;
  onEdit?: () => void;
  onStartExecution: () => void;
  isExecutionDisabled: boolean;
  suiteStatus: TestSuite['status'];
  onStatusChange?: (status: 'ACTIVE' | 'ARCHIVED') => void;
  isStatusChangePending: boolean;
}

function TestSuiteActionMenu({
  canEdit,
  onEdit,
  onStartExecution,
  isExecutionDisabled,
  suiteStatus,
  onStatusChange,
  isStatusChangePending,
}: TestSuiteActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリック・ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isArchived = suiteStatus === 'ARCHIVED';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
        disabled={isStatusChangePending}
        aria-label="テストスイート操作メニュー"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isStatusChangePending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <MoreVertical className="w-5 h-5" />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-dropdown"
          role="menu"
        >
          {/* 編集 */}
          {canEdit && onEdit && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <Pencil className="w-4 h-4" />
              編集
            </button>
          )}

          {/* 実行開始 */}
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              onStartExecution();
              setIsOpen(false);
            }}
            disabled={isExecutionDisabled}
            role="menuitem"
          >
            <Play className="w-4 h-4" />
            実行開始
          </button>

          {/* セパレーター + ステータス切り替え */}
          {canEdit && onStatusChange && (
            <>
              <div className="border-t border-border my-1" />
              {isArchived ? (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
                  onClick={() => {
                    onStatusChange('ACTIVE');
                    setIsOpen(false);
                  }}
                  role="menuitem"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  アクティブにする
                </button>
              ) : (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
                  onClick={() => {
                    onStatusChange('ARCHIVED');
                    setIsOpen(false);
                  }}
                  role="menuitem"
                >
                  <Archive className="w-4 h-4" />
                  アーカイブにする
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * テストケースの3点リーダーアクションメニュー
 */
interface TestCaseActionMenuProps {
  canEdit: boolean;
  onEdit?: () => void;
  onCopy?: () => void;
  testCaseStatus: string;
  onStatusChange?: (status: 'ACTIVE' | 'ARCHIVED') => void;
  isStatusChangePending: boolean;
}

function TestCaseActionMenu({
  canEdit,
  onEdit,
  onCopy,
  testCaseStatus,
  onStatusChange,
  isStatusChangePending,
}: TestCaseActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリック・ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isActive = testCaseStatus === 'ACTIVE';

  // メニュー項目がない場合は何も表示しない
  const hasMenuItems = (canEdit && onEdit) || (canEdit && onCopy) || (canEdit && onStatusChange);
  if (!hasMenuItems) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
        disabled={isStatusChangePending}
        aria-label="テストケース操作メニュー"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isStatusChangePending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <MoreVertical className="w-5 h-5" />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-dropdown"
          role="menu"
        >
          {/* 編集 */}
          {canEdit && onEdit && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <Pencil className="w-4 h-4" />
              編集
            </button>
          )}

          {/* コピー */}
          {canEdit && onCopy && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onCopy();
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <Copy className="w-4 h-4" />
              コピー
            </button>
          )}

          {/* セパレーター + ステータス切り替え */}
          {canEdit && onStatusChange && (
            <>
              <div className="border-t border-border my-1" />
              {/* アクティブでない場合（DRAFT/ARCHIVED）→「アクティブにする」を表示 */}
              {!isActive && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
                  onClick={() => {
                    onStatusChange('ACTIVE');
                    setIsOpen(false);
                  }}
                  role="menuitem"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  アクティブにする
                </button>
              )}
              {/* アクティブの場合→「アーカイブにする」を表示 */}
              {isActive && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
                  onClick={() => {
                    onStatusChange('ARCHIVED');
                    setIsOpen(false);
                  }}
                  role="menuitem"
                >
                  <Archive className="w-4 h-4" />
                  アーカイブにする
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
