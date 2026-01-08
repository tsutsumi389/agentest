import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import type {
  ExecutionTestSuitePrecondition,
  ExecutionTestCasePrecondition,
  ExecutionTestCaseStepSnapshot,
  ExecutionTestCaseExpectedResultSnapshot,
  ExecutionPreconditionResult,
  ExecutionStepResult,
  ExecutionExpectedResult,
  PreconditionResultStatus,
  StepResultStatus,
  ExpectedResultStatus,
} from '../../lib/api';
import type { StatusOption } from '../../lib/execution-status';
import {
  preconditionResultStatusOptions,
  stepResultStatusOptions,
  expectedResultStatusOptions,
} from '../../lib/execution-status';
import { MarkdownPreview } from '../common/markdown';
import { InlineNoteEditor } from './InlineNoteEditor';

/**
 * PiP用ステータスボタングループ
 * select要素の代わりにボタングループでステータスを選択する
 */
function PipStatusButtons<T extends string>({
  value,
  options,
  onChange,
  isEditable,
  isUpdating,
}: {
  value: T;
  options: StatusOption<T>[];
  onChange: (value: T) => void;
  isEditable: boolean;
  isUpdating: boolean;
}) {
  if (isUpdating) {
    return (
      <div className="flex items-center gap-1.5">
        <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
        <span className="text-sm text-foreground-muted">更新中...</span>
      </div>
    );
  }

  if (!isEditable) {
    const currentOption = options.find((opt) => opt.value === value);
    if (!currentOption) return null;
    const IconComponent = currentOption.config.icon;
    return (
      <div className="flex items-center gap-1.5">
        <IconComponent className={`w-4 h-4 ${currentOption.config.colorClass}`} />
        <span className={`text-sm ${currentOption.config.colorClass}`}>{currentOption.config.label}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const isSelected = option.value === value;
        const IconComponent = option.config.icon;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={[
              'flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors',
              isSelected
                ? `${option.config.bgClass} border-current ${option.config.colorClass}`
                : 'bg-background border-border text-foreground-muted hover:bg-background-tertiary',
            ].join(' ')}
            aria-pressed={isSelected}
          >
            <IconComponent className="w-3 h-3" />
            {option.config.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * ナビゲーション可能なアイテムの型
 */
interface NavigableItem {
  type: 'suite-precondition' | 'case-precondition' | 'step' | 'expected';
  /** スナップショットのID */
  snapshotId: string;
  /** 結果のID */
  resultId: string;
  /** 内容 */
  content: string;
  /** インデックス（同種内での1始まり） */
  index: number;
  /** 同種の総数 */
  totalOfType: number;
}

interface PipExecutionPanelProps {
  /** PiPウィンドウへの参照（キーボードイベント登録用） */
  pipWindow: Window | null;
  /** テストケースID（切り替え検知用） */
  testCaseId: string;
  /** テストケースタイトル */
  testCaseTitle: string;
  /** スイートレベル前提条件スナップショット */
  suitePreconditions: ExecutionTestSuitePrecondition[];
  /** テストケースレベル前提条件スナップショット */
  casePreconditions: ExecutionTestCasePrecondition[];
  /** ステップスナップショット一覧 */
  steps: ExecutionTestCaseStepSnapshot[];
  /** 期待結果スナップショット一覧 */
  expectedResults: ExecutionTestCaseExpectedResultSnapshot[];
  /** 前提条件結果（スイート+ケース両方） */
  preconditionResults: ExecutionPreconditionResult[];
  /** ステップ結果一覧 */
  stepResults: ExecutionStepResult[];
  /** 期待結果一覧 */
  expectedResultResults: ExecutionExpectedResult[];
  /** 編集可能か */
  isEditable: boolean;
  /** 更新中の前提条件結果ID（ステータス） */
  updatingPreconditionStatusId: string | null;
  /** 更新中の前提条件結果ID（ノート） */
  updatingPreconditionNoteId: string | null;
  /** 更新中のステップ結果ID（ステータス） */
  updatingStepStatusId: string | null;
  /** 更新中のステップ結果ID（ノート） */
  updatingStepNoteId: string | null;
  /** 更新中の期待結果ID（ステータス） */
  updatingExpectedStatusId: string | null;
  /** 更新中の期待結果ID（ノート） */
  updatingExpectedNoteId: string | null;
  /** 前提条件ステータス変更ハンドラ */
  onPreconditionStatusChange: (resultId: string, status: PreconditionResultStatus) => void;
  /** 前提条件ノート変更ハンドラ */
  onPreconditionNoteChange: (resultId: string, note: string | null) => void;
  /** ステップステータス変更ハンドラ */
  onStepStatusChange: (resultId: string, status: StepResultStatus) => void;
  /** ステップノート変更ハンドラ */
  onStepNoteChange: (resultId: string, note: string | null) => void;
  /** 期待結果ステータス変更ハンドラ */
  onExpectedStatusChange: (resultId: string, status: ExpectedResultStatus) => void;
  /** 期待結果ノート変更ハンドラ */
  onExpectedNoteChange: (resultId: string, note: string | null) => void;
  /** 最初のテストケースかどうか（スイート前提条件表示判定用） */
  isFirstTestCase: boolean;
  /** 現在のテストケースインデックス（0始まり） */
  currentTestCaseIndex: number;
  /** 全テストケース数 */
  totalTestCases: number;
  /** テストケース切り替えハンドラ */
  onNavigateToTestCase: (direction: 'prev' | 'next') => void;
  /** PiPを閉じるハンドラ */
  onClose: () => void;
}

/**
 * Picture-in-Picture ウィンドウ内に表示するコンパクトな実行パネル
 *
 * 表示順序: スイート前提条件（最初のテストケースのみ）→ケース前提条件→ステップ→期待結果
 */
export function PipExecutionPanel({
  pipWindow,
  testCaseId,
  testCaseTitle,
  suitePreconditions,
  casePreconditions,
  steps,
  expectedResults,
  preconditionResults,
  stepResults,
  expectedResultResults,
  isEditable,
  updatingPreconditionStatusId,
  updatingPreconditionNoteId,
  updatingStepStatusId,
  updatingStepNoteId,
  updatingExpectedStatusId,
  updatingExpectedNoteId,
  onPreconditionStatusChange,
  onPreconditionNoteChange,
  onStepStatusChange,
  onStepNoteChange,
  onExpectedStatusChange,
  onExpectedNoteChange,
  isFirstTestCase,
  currentTestCaseIndex,
  totalTestCases,
  onNavigateToTestCase,
  onClose,
}: PipExecutionPanelProps) {
  // ナビゲーション可能なアイテムのリストを構築
  const navigableItems = useMemo((): NavigableItem[] => {
    const items: NavigableItem[] = [];

    // 1. スイートレベル前提条件（最初のテストケースのみ）
    if (isFirstTestCase) {
      const sortedSuitePreconditions = [...suitePreconditions].sort((a, b) => a.orderKey.localeCompare(b.orderKey));
      sortedSuitePreconditions.forEach((precond, index) => {
        const result = preconditionResults.find((r) => r.executionSuitePreconditionId === precond.id);
        if (result) {
          items.push({
            type: 'suite-precondition',
            snapshotId: precond.id,
            resultId: result.id,
            content: precond.content,
            index: index + 1,
            totalOfType: sortedSuitePreconditions.length,
          });
        }
      });
    }

    // 2. テストケースレベル前提条件
    const sortedCasePreconditions = [...casePreconditions].sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    sortedCasePreconditions.forEach((precond, index) => {
      const result = preconditionResults.find((r) => r.executionCasePreconditionId === precond.id);
      if (result) {
        items.push({
          type: 'case-precondition',
          snapshotId: precond.id,
          resultId: result.id,
          content: precond.content,
          index: index + 1,
          totalOfType: sortedCasePreconditions.length,
        });
      }
    });

    // 3. ステップ
    const sortedSteps = [...steps].sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    sortedSteps.forEach((step, index) => {
      const result = stepResults.find((r) => r.executionStepId === step.id);
      if (result) {
        items.push({
          type: 'step',
          snapshotId: step.id,
          resultId: result.id,
          content: step.content,
          index: index + 1,
          totalOfType: sortedSteps.length,
        });
      }
    });

    // 4. 期待結果
    const sortedExpectedResults = [...expectedResults].sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    sortedExpectedResults.forEach((er, index) => {
      const result = expectedResultResults.find((r) => r.executionExpectedResultId === er.id);
      if (result) {
        items.push({
          type: 'expected',
          snapshotId: er.id,
          resultId: result.id,
          content: er.content,
          index: index + 1,
          totalOfType: sortedExpectedResults.length,
        });
      }
    });

    return items;
  }, [isFirstTestCase, suitePreconditions, casePreconditions, steps, expectedResults, preconditionResults, stepResults, expectedResultResults]);

  // 現在のインデックス
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalItems = navigableItems.length;

  // テストケースが切り替わったらcurrentIndexをリセット
  useEffect(() => {
    setCurrentIndex(0);
  }, [testCaseId]);

  // navigableItems が変更された時に currentIndex が範囲外にならないよう調整
  useEffect(() => {
    if (currentIndex >= navigableItems.length && navigableItems.length > 0) {
      setCurrentIndex(navigableItems.length - 1);
    }
  }, [navigableItems.length, currentIndex]);

  const currentItem = navigableItems[currentIndex];

  // 前へ/次へ（アイテム内）
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalItems]);

  // キーボードナビゲーション（左右矢印キー）
  useEffect(() => {
    const targetWindow = pipWindow ?? window;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合はスキップ
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };
    targetWindow.addEventListener('keydown', handleKeyDown);
    return () => targetWindow.removeEventListener('keydown', handleKeyDown);
  }, [pipWindow, goToPrevious, goToNext]);

  // 現在のアイテムの結果データを取得
  const currentPreconditionResult = (currentItem?.type === 'suite-precondition' || currentItem?.type === 'case-precondition')
    ? preconditionResults.find((r) => r.id === currentItem.resultId)
    : null;
  const currentStepResult = currentItem?.type === 'step'
    ? stepResults.find((r) => r.id === currentItem.resultId)
    : null;
  const currentExpectedResult = currentItem?.type === 'expected'
    ? expectedResultResults.find((r) => r.id === currentItem.resultId)
    : null;

  // アイテム種類ごとのラベルとスタイル
  const getItemTypeConfig = (type: NavigableItem['type']) => {
    switch (type) {
      case 'suite-precondition':
        return { label: 'スイート前提条件', bgClass: 'bg-purple-900/30', textClass: 'text-purple-400' };
      case 'case-precondition':
        return { label: 'ケース前提条件', bgClass: 'bg-purple-900/30', textClass: 'text-purple-400' };
      case 'step':
        return { label: 'ステップ', bgClass: 'bg-accent-subtle', textClass: 'text-accent' };
      case 'expected':
        return { label: '期待結果', bgClass: 'bg-success-subtle', textClass: 'text-success' };
    }
  };

  // アイテムがない場合
  if (!currentItem) {
    return (
      <div className="min-h-full bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-sm font-medium text-foreground truncate">{testCaseTitle}</h1>
          <button
            onClick={onClose}
            className="p-1 hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-4 h-4 text-foreground-muted" />
          </button>
        </div>
        <p className="text-foreground-muted text-sm">表示するアイテムがありません</p>
      </div>
    );
  }

  const itemTypeConfig = getItemTypeConfig(currentItem.type);

  return (
    <div className="min-h-full bg-background flex flex-col">
      {/* ヘッダー: テストケースナビゲーション */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-background-secondary">
        <button
          onClick={() => onNavigateToTestCase('prev')}
          disabled={currentTestCaseIndex === 0}
          className="flex items-center gap-0.5 px-2 py-1 text-xs rounded border border-border hover:bg-background-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="前のテストケース"
        >
          <ChevronLeft className="w-3 h-3" />
          前へ
        </button>

        <span className="text-xs text-foreground-muted font-medium">
          テストケース {currentTestCaseIndex + 1} / {totalTestCases}
        </span>

        <button
          onClick={() => onNavigateToTestCase('next')}
          disabled={currentTestCaseIndex === totalTestCases - 1}
          className="flex items-center gap-0.5 px-2 py-1 text-xs rounded border border-border hover:bg-background-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="次のテストケース"
        >
          次へ
          <ChevronRight className="w-3 h-3" />
        </button>
      </header>

      {/* テストケースタイトル + 閉じるボタン */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h1 className="text-sm font-medium text-foreground truncate flex-1 mr-2">
          {testCaseTitle}
        </h1>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-background-tertiary rounded transition-colors"
          aria-label="閉じる"
        >
          <X className="w-4 h-4 text-foreground-muted" />
        </button>
      </div>

      {/* メインコンテンツ */}
      <main className="flex-1 p-4 space-y-4 overflow-auto">
        {/* 種類とインデックス表示 */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${itemTypeConfig.bgClass} ${itemTypeConfig.textClass}`}>
            {itemTypeConfig.label}
          </span>
          <span className="text-sm text-foreground-muted">
            {currentItem.index} / {currentItem.totalOfType}
          </span>
        </div>

        {/* コンテンツ */}
        <div className="text-sm text-foreground leading-relaxed">
          <MarkdownPreview content={currentItem.content} />
        </div>

        {/* ステータス変更 */}
        <div className="space-y-2">
          <span className="text-xs text-foreground-muted">ステータス:</span>
          {(currentItem.type === 'suite-precondition' || currentItem.type === 'case-precondition') && currentPreconditionResult ? (
            <PipStatusButtons
              value={currentPreconditionResult.status}
              options={preconditionResultStatusOptions}
              onChange={(status) => onPreconditionStatusChange(currentPreconditionResult.id, status)}
              isEditable={isEditable}
              isUpdating={updatingPreconditionStatusId === currentPreconditionResult.id}
            />
          ) : currentItem.type === 'step' && currentStepResult ? (
            <PipStatusButtons
              value={currentStepResult.status}
              options={stepResultStatusOptions}
              onChange={(status) => onStepStatusChange(currentStepResult.id, status)}
              isEditable={isEditable}
              isUpdating={updatingStepStatusId === currentStepResult.id}
            />
          ) : currentItem.type === 'expected' && currentExpectedResult ? (
            <PipStatusButtons
              value={currentExpectedResult.status}
              options={expectedResultStatusOptions}
              onChange={(status) => onExpectedStatusChange(currentExpectedResult.id, status)}
              isEditable={isEditable}
              isUpdating={updatingExpectedStatusId === currentExpectedResult.id}
            />
          ) : null}
        </div>

        {/* ノート */}
        <div className="space-y-1">
          <span className="text-xs text-foreground-muted">ノート:</span>
          {(currentItem.type === 'suite-precondition' || currentItem.type === 'case-precondition') && currentPreconditionResult ? (
            <InlineNoteEditor
              value={currentPreconditionResult.note}
              onChange={(note) => onPreconditionNoteChange(currentPreconditionResult.id, note)}
              isEditable={isEditable}
              isUpdating={updatingPreconditionNoteId === currentPreconditionResult.id}
              placeholder="ノートを入力..."
            />
          ) : currentItem.type === 'step' && currentStepResult ? (
            <InlineNoteEditor
              value={currentStepResult.note}
              onChange={(note) => onStepNoteChange(currentStepResult.id, note)}
              isEditable={isEditable}
              isUpdating={updatingStepNoteId === currentStepResult.id}
              placeholder="ノートを入力..."
            />
          ) : currentItem.type === 'expected' && currentExpectedResult ? (
            <InlineNoteEditor
              value={currentExpectedResult.note}
              onChange={(note) => onExpectedNoteChange(currentExpectedResult.id, note)}
              isEditable={isEditable}
              isUpdating={updatingExpectedNoteId === currentExpectedResult.id}
              placeholder="ノートを入力..."
            />
          ) : null}
        </div>
      </main>

      {/* フッター: アイテムナビゲーション */}
      <footer className="flex items-center justify-between px-4 py-3 border-t border-border bg-background-secondary">
        <button
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-border hover:bg-background-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="前へ"
        >
          <ChevronLeft className="w-4 h-4" />
          前へ
        </button>

        <span className="text-xs text-foreground-muted">
          全体: {currentIndex + 1} / {totalItems}
        </span>

        <button
          onClick={goToNext}
          disabled={currentIndex === totalItems - 1}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-border hover:bg-background-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="次へ"
        >
          次へ
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
