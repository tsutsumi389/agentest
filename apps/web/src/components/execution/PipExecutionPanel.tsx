import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import type {
  ExecutionTestCaseStepSnapshot,
  ExecutionTestCaseExpectedResultSnapshot,
  ExecutionStepResult,
  ExecutionExpectedResult,
  StepResultStatus,
  ExpectedResultStatus,
} from '../../lib/api';
import type { StatusConfig, StatusOption } from '../../lib/execution-status';
import {
  stepResultStatusOptions,
  expectedResultStatusOptions,
  getStepStatusConfig,
  getExpectedStatusConfig,
} from '../../lib/execution-status';
import { InlineNoteEditor } from './InlineNoteEditor';

/**
 * PiP用シンプルステータスセレクター
 * StatusButtonはdocument.addEventListenerを使用するため、PiPウィンドウでは
 * 親ウィンドウのdocumentを参照してしまう。このコンポーネントはselect要素を
 * 使用することでその問題を回避する。
 */
function PipStatusSelector<T extends string>({
  value,
  config,
  options,
  onChange,
  isEditable,
  isUpdating,
}: {
  value: T;
  config: StatusConfig;
  options: StatusOption<T>[];
  onChange: (value: T) => void;
  isEditable: boolean;
  isUpdating: boolean;
}) {
  if (!isEditable) {
    const IconComponent = config.icon;
    return (
      <div className="flex items-center gap-1.5">
        <IconComponent className={`w-4 h-4 ${config.colorClass}`} />
        <span className={`text-sm ${config.colorClass}`}>{config.label}</span>
      </div>
    );
  }

  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-2">
      {isUpdating ? (
        <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
      ) : (
        <IconComponent className={`w-4 h-4 ${config.colorClass}`} />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        disabled={isUpdating}
        className="text-sm bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        aria-label="ステータスを選択"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.config.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * ナビゲーション可能なアイテムの型
 */
interface NavigableItem {
  type: 'step' | 'expected';
  /** スナップショットのID */
  snapshotId: string;
  /** 結果のID */
  resultId: string;
  /** 内容 */
  content: string;
  /** インデックス（1始まり） */
  index: number;
}

interface PipExecutionPanelProps {
  /** テストケースタイトル */
  testCaseTitle: string;
  /** ステップスナップショット一覧 */
  steps: ExecutionTestCaseStepSnapshot[];
  /** 期待結果スナップショット一覧 */
  expectedResults: ExecutionTestCaseExpectedResultSnapshot[];
  /** ステップ結果一覧 */
  stepResults: ExecutionStepResult[];
  /** 期待結果一覧 */
  expectedResultResults: ExecutionExpectedResult[];
  /** 編集可能か */
  isEditable: boolean;
  /** 更新中のステップ結果ID（ステータス） */
  updatingStepStatusId: string | null;
  /** 更新中のステップ結果ID（ノート） */
  updatingStepNoteId: string | null;
  /** 更新中の期待結果ID（ステータス） */
  updatingExpectedStatusId: string | null;
  /** 更新中の期待結果ID（ノート） */
  updatingExpectedNoteId: string | null;
  /** ステップステータス変更ハンドラ */
  onStepStatusChange: (resultId: string, status: StepResultStatus) => void;
  /** ステップノート変更ハンドラ */
  onStepNoteChange: (resultId: string, note: string | null) => void;
  /** 期待結果ステータス変更ハンドラ */
  onExpectedStatusChange: (resultId: string, status: ExpectedResultStatus) => void;
  /** 期待結果ノート変更ハンドラ */
  onExpectedNoteChange: (resultId: string, note: string | null) => void;
  /** PiPを閉じるハンドラ */
  onClose: () => void;
}

/**
 * Picture-in-Picture ウィンドウ内に表示するコンパクトな実行パネル
 *
 * ステップと期待結果を順番にナビゲートしながらステータス更新を行えます。
 */
export function PipExecutionPanel({
  testCaseTitle,
  steps,
  expectedResults,
  stepResults,
  expectedResultResults,
  isEditable,
  updatingStepStatusId,
  updatingStepNoteId,
  updatingExpectedStatusId,
  updatingExpectedNoteId,
  onStepStatusChange,
  onStepNoteChange,
  onExpectedStatusChange,
  onExpectedNoteChange,
  onClose,
}: PipExecutionPanelProps) {
  // ナビゲーション可能なアイテムのリストを構築
  const navigableItems = useMemo((): NavigableItem[] => {
    const items: NavigableItem[] = [];

    // ステップを追加
    steps.forEach((step, index) => {
      const result = stepResults.find((r) => r.executionStepId === step.id);
      if (result) {
        items.push({
          type: 'step',
          snapshotId: step.id,
          resultId: result.id,
          content: step.content,
          index: index + 1,
        });
      }
    });

    // 期待結果を追加
    expectedResults.forEach((er, index) => {
      const result = expectedResultResults.find((r) => r.executionExpectedResultId === er.id);
      if (result) {
        items.push({
          type: 'expected',
          snapshotId: er.id,
          resultId: result.id,
          content: er.content,
          index: index + 1,
        });
      }
    });

    return items;
  }, [steps, expectedResults, stepResults, expectedResultResults]);

  // 現在のインデックス
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalItems = navigableItems.length;

  // navigableItems が変更された時に currentIndex が範囲外にならないよう調整
  useEffect(() => {
    if (currentIndex >= navigableItems.length && navigableItems.length > 0) {
      setCurrentIndex(navigableItems.length - 1);
    }
  }, [navigableItems.length, currentIndex]);

  const currentItem = navigableItems[currentIndex];

  // 前へ/次へ
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext]);

  // 現在のアイテムの結果データを取得
  const currentStepResult = currentItem?.type === 'step'
    ? stepResults.find((r) => r.id === currentItem.resultId)
    : null;
  const currentExpectedResult = currentItem?.type === 'expected'
    ? expectedResultResults.find((r) => r.id === currentItem.resultId)
    : null;

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

  // 現在のアイテムの種類に応じたステータス設定
  const isStep = currentItem.type === 'step';
  const statusConfig = isStep
    ? getStepStatusConfig(currentStepResult?.status ?? 'PENDING')
    : getExpectedStatusConfig(currentExpectedResult?.status ?? 'PENDING');

  return (
    <div className="min-h-full bg-background flex flex-col">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background-secondary">
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
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 p-4 space-y-4 overflow-auto">
        {/* 種類とインデックス表示 */}
        <div className="flex items-center gap-2">
          <span className={`
            text-xs font-medium px-2 py-0.5 rounded
            ${isStep ? 'bg-accent-subtle text-accent' : 'bg-success-subtle text-success'}
          `}>
            {isStep ? 'ステップ' : '期待結果'}
          </span>
          <span className="text-sm text-foreground-muted">
            {currentItem.index} / {isStep ? steps.length : expectedResults.length}
          </span>
        </div>

        {/* コンテンツ */}
        <div className="text-sm text-foreground leading-relaxed">
          {currentItem.content}
        </div>

        {/* ステータス変更 */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-foreground-muted">ステータス:</span>
          {isStep && currentStepResult ? (
            <PipStatusSelector
              value={currentStepResult.status}
              config={statusConfig}
              options={stepResultStatusOptions}
              onChange={(status) => onStepStatusChange(currentStepResult.id, status)}
              isEditable={isEditable}
              isUpdating={updatingStepStatusId === currentStepResult.id}
            />
          ) : currentExpectedResult ? (
            <PipStatusSelector
              value={currentExpectedResult.status}
              config={statusConfig}
              options={expectedResultStatusOptions}
              onChange={(status) => onExpectedStatusChange(currentExpectedResult.id, status)}
              isEditable={isEditable}
              isUpdating={updatingExpectedStatusId === currentExpectedResult.id}
            />
          ) : null}
        </div>

        {/* ノート（簡易版） */}
        <div className="space-y-1">
          <span className="text-xs text-foreground-muted">ノート:</span>
          {isStep && currentStepResult ? (
            <InlineNoteEditor
              value={currentStepResult.note}
              onChange={(note) => onStepNoteChange(currentStepResult.id, note)}
              isEditable={isEditable}
              isUpdating={updatingStepNoteId === currentStepResult.id}
              placeholder="ノートを入力..."
            />
          ) : currentExpectedResult ? (
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

      {/* フッター: ナビゲーション */}
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
