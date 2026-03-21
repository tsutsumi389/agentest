import { useState, useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { testCasesApi, ApiError, type TestCaseWithDetails } from '../../lib/api';
import { PRIORITY_OPTIONS, STATUS_TOGGLE_OPTIONS } from '../../lib/constants';
import { toast } from '../../stores/toast';
import { MentionInput } from '../common/MentionInput';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  DynamicListSection,
  useDndSensors,
  addListItem,
  updateListItem,
  deleteListItem,
  createDragEndHandler,
  type ListItem,
} from '../common/DynamicListSection';
import { MarkdownEditor } from '../common/markdown';

interface TestCaseFormProps {
  /** フォームモード */
  mode: 'create' | 'edit';
  /** テストスイートID */
  testSuiteId: string;
  /** プロジェクトID（MentionInput用） */
  projectId: string;
  /** 編集対象のテストケース（編集時のみ） */
  testCase?: TestCaseWithDetails;
  /** 保存完了時のコールバック（作成時は作成されたテストケースIDを渡す） */
  onSave: (createdTestCaseId?: string) => void;
  /** キャンセル時のコールバック */
  onCancel: () => void;
}

/**
 * テストケース作成・編集共通フォーム
 */
export function TestCaseForm({
  mode,
  testSuiteId,
  projectId,
  testCase,
  onSave,
  onCancel,
}: TestCaseFormProps) {
  const queryClient = useQueryClient();

  // フォーム値の状態
  const [title, setTitle] = useState(testCase?.title || '');
  const [description, setDescription] = useState(testCase?.description || '');
  const [priority, setPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>(
    testCase?.priority || 'MEDIUM'
  );
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>(
    testCase?.status || 'ACTIVE'
  );

  // 動的リストの状態
  const [preconditions, setPreconditions] = useState<ListItem[]>(
    testCase?.preconditions.map((p) => ({
      id: p.id,
      content: p.content,
      originalContent: p.content,
    })) || []
  );
  const [steps, setSteps] = useState<ListItem[]>(
    testCase?.steps.map((s) => ({
      id: s.id,
      content: s.content,
      originalContent: s.content,
    })) || []
  );
  const [expectedResults, setExpectedResults] = useState<ListItem[]>(
    testCase?.expectedResults.map((e) => ({
      id: e.id,
      content: e.content,
      originalContent: e.content,
    })) || []
  );

  // セクションの展開状態
  const [expandedSections, setExpandedSections] = useState({
    preconditions: true,
    steps: true,
    expectedResults: true,
  });

  // コピー元テストケースID（コピー時に使用）
  const [sourceTestCaseId, setSourceTestCaseId] = useState<string | null>(null);

  // 保存処理の状態
  const [isSaving, setIsSaving] = useState(false);

  // フォームに変更があるかどうかを判定
  const hasChanges = useMemo(() => {
    if (mode === 'create') {
      // 新規作成時：何か入力があれば変更あり
      return (
        title.trim() !== '' ||
        description.trim() !== '' ||
        priority !== 'MEDIUM' ||
        status !== 'ACTIVE' ||
        preconditions.filter((p) => !p.isDeleted && p.content.trim()).length > 0 ||
        steps.filter((s) => !s.isDeleted && s.content.trim()).length > 0 ||
        expectedResults.filter((e) => !e.isDeleted && e.content.trim()).length > 0
      );
    }
    // 編集時：元の値と異なれば変更あり
    if (!testCase) return false;

    const titleChanged = title.trim() !== testCase.title;
    const descriptionChanged = description.trim() !== (testCase.description || '');
    const priorityChanged = priority !== testCase.priority;
    const statusChanged = status !== testCase.status;

    // 前提条件の変更チェック
    const activePreconditions = preconditions.filter((p) => !p.isDeleted);
    const preconditionsChanged =
      activePreconditions.length !== testCase.preconditions.length ||
      activePreconditions.some((p, i) => {
        if (p.isNew) return true;
        const original = testCase.preconditions[i];
        return !original || p.content.trim() !== original.content;
      });

    // ステップの変更チェック
    const activeSteps = steps.filter((s) => !s.isDeleted);
    const stepsChanged =
      activeSteps.length !== testCase.steps.length ||
      activeSteps.some((s, i) => {
        if (s.isNew) return true;
        const original = testCase.steps[i];
        return !original || s.content.trim() !== original.content;
      });

    // 期待結果の変更チェック
    const activeExpectedResults = expectedResults.filter((e) => !e.isDeleted);
    const expectedResultsChanged =
      activeExpectedResults.length !== testCase.expectedResults.length ||
      activeExpectedResults.some((e, i) => {
        if (e.isNew) return true;
        const original = testCase.expectedResults[i];
        return !original || e.content.trim() !== original.content;
      });

    return (
      titleChanged ||
      descriptionChanged ||
      priorityChanged ||
      statusChanged ||
      preconditionsChanged ||
      stepsChanged ||
      expectedResultsChanged
    );
  }, [mode, testCase, title, description, priority, status, preconditions, steps, expectedResults]);

  // キャンセル確認ダイアログの状態
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // ブラウザの閉じる/リロード警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && !isSaving) {
        e.preventDefault();
        // 最新のブラウザでは returnValue を設定するだけで警告が表示される
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges, isSaving]);

  // キャンセルボタンのハンドラ
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      setShowCancelConfirm(true);
    } else {
      onCancel();
    }
  }, [hasChanges, onCancel]);

  // dnd-kit センサー設定
  const sensors = useDndSensors();

  // テストケース選択ハンドラ（コピー機能）
  const handleTestCaseSelect = (selectedTestCase: TestCaseWithDetails) => {
    setSourceTestCaseId(selectedTestCase.id);
    setTitle(selectedTestCase.title);
    setDescription(selectedTestCase.description || '');
    setPriority(selectedTestCase.priority);
    setPreconditions(
      selectedTestCase.preconditions.map((p) => ({
        id: crypto.randomUUID(),
        content: p.content,
        isNew: true,
      }))
    );
    setSteps(
      selectedTestCase.steps.map((s) => ({
        id: crypto.randomUUID(),
        content: s.content,
        isNew: true,
      }))
    );
    setExpectedResults(
      selectedTestCase.expectedResults.map((e) => ({
        id: crypto.randomUUID(),
        content: e.content,
        isNew: true,
      }))
    );
    toast.info(`「${selectedTestCase.title}」の内容をコピーしました`);
  };

  // コピー作成用mutation
  const copyMutation = useMutation({
    mutationFn: (data: { sourceTestCaseId: string; title: string; targetTestSuiteId: string }) =>
      testCasesApi.copy(data.sourceTestCaseId, {
        title: data.title,
        targetTestSuiteId: data.targetTestSuiteId,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
      toast.success('テストケースをコピーしました');
      onSave(data.testCase.id);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('テストケースのコピーに失敗しました');
      }
    },
  });

  // フォーム送信ハンドラ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('タイトルを入力してください');
      return;
    }

    setIsSaving(true);

    try {
      if (mode === 'create') {
        // コピー元がある場合はcopy APIを使用
        if (sourceTestCaseId) {
          await copyMutation.mutateAsync({
            sourceTestCaseId,
            title,
            targetTestSuiteId: testSuiteId,
          });
          return;
        }

        // 新規作成
        const { testCase: createdTestCase } = await testCasesApi.create({
          testSuiteId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          status,
        });

        // 各項目を順次追加
        const activeItems = {
          preconditions: preconditions.filter((p) => !p.isDeleted && p.content.trim()),
          steps: steps.filter((s) => !s.isDeleted && s.content.trim()),
          expectedResults: expectedResults.filter((e) => !e.isDeleted && e.content.trim()),
        };

        // 新規作成時も子エンティティを同一グループとして扱うためのgroupIdを生成
        const groupId = crypto.randomUUID();

        // 各項目を並列で追加
        await Promise.all([
          ...activeItems.preconditions.map((item) =>
            testCasesApi.addPrecondition(createdTestCase.id, {
              content: item.content.trim(),
              groupId,
            })
          ),
          ...activeItems.steps.map((item) =>
            testCasesApi.addStep(createdTestCase.id, {
              content: item.content.trim(),
              groupId,
            })
          ),
          ...activeItems.expectedResults.map((item) =>
            testCasesApi.addExpectedResult(createdTestCase.id, {
              content: item.content.trim(),
              groupId,
            })
          ),
        ]);

        queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
        toast.success('テストケースを作成しました');
        onSave(createdTestCase.id);
        return;
      } else if (mode === 'edit' && testCase) {
        // 編集モード
        // 全ての変更を同一グループとして扱うためのgroupIdを生成
        const groupId = crypto.randomUUID();

        // 基本情報の更新
        const updates: {
          title?: string;
          description?: string;
          priority?: string;
          status?: string;
          groupId?: string;
        } = {};
        if (title.trim() !== testCase.title) {
          updates.title = title.trim();
        }
        if (description.trim() !== (testCase.description || '')) {
          updates.description = description.trim();
        }
        if (priority !== testCase.priority) {
          updates.priority = priority;
        }
        if (status !== testCase.status) {
          updates.status = status;
        }

        if (Object.keys(updates).length > 0) {
          updates.groupId = groupId;
          await testCasesApi.update(testCase.id, updates);
        }

        // 前提条件・ステップ・期待結果の差分更新を並列実行
        await Promise.all([
          updateListItems(testCase.id, 'precondition', preconditions, groupId),
          updateListItems(testCase.id, 'step', steps, groupId),
          updateListItems(testCase.id, 'expectedResult', expectedResults, groupId),
        ]);

        queryClient.invalidateQueries({ queryKey: ['test-case-details', testCase.id] });
        queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
        toast.success('テストケースを更新しました');
      }

      onSave();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('保存に失敗しました');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // リスト項目の差分更新
  const updateListItems = async (
    testCaseId: string,
    type: 'precondition' | 'step' | 'expectedResult',
    items: ListItem[],
    groupId?: string
  ) => {
    const api = {
      precondition: {
        add: (id: string, data: { content: string; groupId?: string }) =>
          testCasesApi.addPrecondition(id, data),
        update: (id: string, itemId: string, data: { content: string; groupId?: string }) =>
          testCasesApi.updatePrecondition(id, itemId, data),
        delete: (id: string, itemId: string, gId?: string) =>
          testCasesApi.deletePrecondition(id, itemId, gId),
        reorder: (id: string, ids: string[], gId?: string) =>
          testCasesApi.reorderPreconditions(id, ids, gId),
      },
      step: {
        add: (id: string, data: { content: string; groupId?: string }) =>
          testCasesApi.addStep(id, data),
        update: (id: string, itemId: string, data: { content: string; groupId?: string }) =>
          testCasesApi.updateStep(id, itemId, data),
        delete: (id: string, itemId: string, gId?: string) =>
          testCasesApi.deleteStep(id, itemId, gId),
        reorder: (id: string, ids: string[], gId?: string) =>
          testCasesApi.reorderSteps(id, ids, gId),
      },
      expectedResult: {
        add: (id: string, data: { content: string; groupId?: string }) =>
          testCasesApi.addExpectedResult(id, data),
        update: (id: string, itemId: string, data: { content: string; groupId?: string }) =>
          testCasesApi.updateExpectedResult(id, itemId, data),
        delete: (id: string, itemId: string, gId?: string) =>
          testCasesApi.deleteExpectedResult(id, itemId, gId),
        reorder: (id: string, ids: string[], gId?: string) =>
          testCasesApi.reorderExpectedResults(id, ids, gId),
      },
    }[type];

    // 削除された項目を並列処理
    await Promise.all(
      items
        .filter((i) => i.isDeleted && !i.isNew)
        .map((item) => api.delete(testCaseId, item.id, groupId))
    );

    // 新規追加された項目を並列処理
    const addResults = await Promise.all(
      items
        .filter((i) => i.isNew && !i.isDeleted && i.content.trim())
        .map(async (item) => {
          const result = await api.add(testCaseId, { content: item.content.trim(), groupId });
          const realId =
            'precondition' in result
              ? result.precondition.id
              : 'step' in result
                ? result.step.id
                : result.expectedResult.id;
          return { tempId: item.id, realId };
        })
    );
    const newItems = addResults;

    // 更新された項目を並列処理
    await Promise.all(
      items
        .filter((i) => !i.isNew && !i.isDeleted && i.content.trim() !== i.originalContent)
        .map((item) => api.update(testCaseId, item.id, { content: item.content.trim(), groupId }))
    );

    // 並び順の更新
    const activeItems = items.filter((i) => !i.isDeleted && i.content.trim());
    if (activeItems.length > 0) {
      const orderedIds = activeItems.map((item) => {
        const newItem = newItems.find((n) => n.tempId === item.id);
        return newItem ? newItem.realId : item.id;
      });
      // 並び順が変わっている場合のみreorderを呼び出す
      const currentOrder = items.filter((i) => !i.isNew && !i.isDeleted).map((i) => i.id);
      const hasOrderChanged =
        orderedIds.length !== currentOrder.length ||
        orderedIds.some((id, index) => id !== currentOrder[index]);

      if (hasOrderChanged || newItems.length > 0) {
        await api.reorder(testCaseId, orderedIds, groupId);
      }
    }
  };

  // セクション展開/折りたたみのトグル
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isPending = isSaving || copyMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          {mode === 'create' ? '新規テストケース作成' : 'テストケース編集'}
        </h2>
      </div>

      {/* フォーム本体 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* タイトル */}
        <div>
          <label htmlFor="case-title" className="block text-sm font-medium text-foreground mb-1">
            タイトル <span className="text-danger">*</span>
          </label>
          {mode === 'create' ? (
            <MentionInput
              value={title}
              onChange={setTitle}
              projectId={projectId}
              onTestCaseSelect={handleTestCaseSelect}
              placeholder="例: ログインフォームの表示確認（@でテストケース参照）"
            />
          ) : (
            <input
              id="case-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
              placeholder="テストケースのタイトル"
            />
          )}
        </div>

        {/* 説明 */}
        <div>
          <label
            htmlFor="case-description"
            className="block text-sm font-medium text-foreground mb-1"
          >
            説明
          </label>
          <MarkdownEditor
            id="case-description"
            value={description}
            onChange={setDescription}
            placeholder="テストケースの説明を入力...（Markdown対応）"
            rows={3}
          />
        </div>

        {/* 優先度 */}
        <div>
          <label htmlFor="case-priority" className="block text-sm font-medium text-foreground mb-1">
            優先度
          </label>
          <select
            id="case-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            className="input"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* ステータス（ARCHIVEDの場合はトグル無効） */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">ステータス</label>
          {status === 'ARCHIVED' ? (
            <p className="text-sm text-foreground-muted">アーカイブ</p>
          ) : (
            <div
              className="inline-flex rounded-md border border-border"
              role="radiogroup"
              aria-label="ステータス"
            >
              {STATUS_TOGGLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={status === option.value}
                  onClick={() => setStatus(option.value)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                    status === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-foreground-muted hover:text-foreground hover:bg-background-hover'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 前提条件 */}
        <DynamicListSection
          title="前提条件"
          items={preconditions.filter((i) => !i.isDeleted)}
          isExpanded={expandedSections.preconditions}
          onToggle={() => toggleSection('preconditions')}
          onAdd={() => addListItem(setPreconditions)}
          onUpdate={(id, content) => updateListItem(setPreconditions, id, content)}
          onDelete={(id) => deleteListItem(setPreconditions, id)}
          onDragEnd={createDragEndHandler(preconditions, setPreconditions)}
          sensors={sensors}
          placeholder="前提条件を入力...（Markdown対応）"
          useMarkdown
        />

        {/* 手順 */}
        <DynamicListSection
          title="手順"
          items={steps.filter((i) => !i.isDeleted)}
          isExpanded={expandedSections.steps}
          onToggle={() => toggleSection('steps')}
          onAdd={() => addListItem(setSteps)}
          onUpdate={(id, content) => updateListItem(setSteps, id, content)}
          onDelete={(id) => deleteListItem(setSteps, id)}
          onDragEnd={createDragEndHandler(steps, setSteps)}
          sensors={sensors}
          placeholder="手順を入力...（Markdown対応）"
          useMarkdown
        />

        {/* 期待結果 */}
        <DynamicListSection
          title="期待結果"
          items={expectedResults.filter((i) => !i.isDeleted)}
          isExpanded={expandedSections.expectedResults}
          onToggle={() => toggleSection('expectedResults')}
          onAdd={() => addListItem(setExpectedResults)}
          onUpdate={(id, content) => updateListItem(setExpectedResults, id, content)}
          onDelete={(id) => deleteListItem(setExpectedResults, id)}
          onDragEnd={createDragEndHandler(expectedResults, setExpectedResults)}
          sensors={sensors}
          placeholder="期待結果を入力...（Markdown対応）"
          useMarkdown
        />
      </div>

      {/* フッター */}
      <div className="flex-shrink-0 p-4 border-t border-border flex justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="btn btn-secondary"
          disabled={isPending}
        >
          キャンセル
        </button>
        <button type="submit" className="btn btn-primary" disabled={!title.trim() || isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : mode === 'create' ? (
            sourceTestCaseId ? (
              'コピーして作成'
            ) : (
              '作成'
            )
          ) : (
            '保存'
          )}
        </button>
      </div>

      {/* キャンセル確認ダイアログ */}
      {showCancelConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="変更を破棄しますか？"
          message="入力中の内容は保存されていません。キャンセルすると変更が失われます。"
          confirmLabel="破棄する"
          onConfirm={() => {
            setShowCancelConfirm(false);
            onCancel();
          }}
          onCancel={() => setShowCancelConfirm(false)}
          isDanger
        />
      )}
    </form>
  );
}
