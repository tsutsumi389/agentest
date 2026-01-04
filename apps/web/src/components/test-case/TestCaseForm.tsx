import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  testCasesApi,
  ApiError,
  type TestCaseWithDetails,
} from '../../lib/api';
import { toast } from '../../stores/toast';
import { MentionInput } from '../common/MentionInput';

/**
 * 動的リスト項目の型
 */
interface ListItem {
  id: string;
  content: string;
  isNew?: boolean; // 新規追加された項目
  isDeleted?: boolean; // 削除された項目
  originalContent?: string; // 編集時の元の内容
}

/**
 * 優先度オプション
 */
const PRIORITY_OPTIONS = [
  { value: 'CRITICAL', label: '緊急' },
  { value: 'HIGH', label: '高' },
  { value: 'MEDIUM', label: '中' },
  { value: 'LOW', label: '低' },
] as const;

interface TestCaseFormProps {
  /** フォームモード */
  mode: 'create' | 'edit';
  /** テストスイートID */
  testSuiteId: string;
  /** プロジェクトID（MentionInput用） */
  projectId: string;
  /** 編集対象のテストケース（編集時のみ） */
  testCase?: TestCaseWithDetails;
  /** 保存完了時のコールバック */
  onSave: () => void;
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

  // dnd-kit センサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // テストケース選択ハンドラ（コピー機能）
  const handleTestCaseSelect = (selectedTestCase: TestCaseWithDetails) => {
    setSourceTestCaseId(selectedTestCase.id);
    setTitle(selectedTestCase.title);
    setDescription(selectedTestCase.description || '');
    setPriority(selectedTestCase.priority);
    setPreconditions(
      selectedTestCase.preconditions.map((p) => ({
        id: `new-${Date.now()}-${Math.random()}`,
        content: p.content,
        isNew: true,
      }))
    );
    setSteps(
      selectedTestCase.steps.map((s) => ({
        id: `new-${Date.now()}-${Math.random()}`,
        content: s.content,
        isNew: true,
      }))
    );
    setExpectedResults(
      selectedTestCase.expectedResults.map((e) => ({
        id: `new-${Date.now()}-${Math.random()}`,
        content: e.content,
        isNew: true,
      }))
    );
    toast.info(`「${selectedTestCase.title}」の内容をコピーしました`);
  };

  // コピー作成用mutation
  const copyMutation = useMutation({
    mutationFn: (data: { sourceTestCaseId: string; title: string; targetTestSuiteId: string }) =>
      testCasesApi.copy(data.sourceTestCaseId, { title: data.title, targetTestSuiteId: data.targetTestSuiteId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
      toast.success('テストケースをコピーしました');
      onSave();
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
        });

        // 各項目を順次追加
        const activeItems = {
          preconditions: preconditions.filter((p) => !p.isDeleted && p.content.trim()),
          steps: steps.filter((s) => !s.isDeleted && s.content.trim()),
          expectedResults: expectedResults.filter((e) => !e.isDeleted && e.content.trim()),
        };

        // 前提条件を追加
        for (const item of activeItems.preconditions) {
          await testCasesApi.addPrecondition(createdTestCase.id, { content: item.content.trim() });
        }

        // ステップを追加
        for (const item of activeItems.steps) {
          await testCasesApi.addStep(createdTestCase.id, { content: item.content.trim() });
        }

        // 期待結果を追加
        for (const item of activeItems.expectedResults) {
          await testCasesApi.addExpectedResult(createdTestCase.id, { content: item.content.trim() });
        }

        queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
        toast.success('テストケースを作成しました');
      } else if (mode === 'edit' && testCase) {
        // 編集モード
        // 基本情報の更新
        const updates: { title?: string; description?: string; priority?: string } = {};
        if (title.trim() !== testCase.title) {
          updates.title = title.trim();
        }
        if (description.trim() !== (testCase.description || '')) {
          updates.description = description.trim();
        }
        if (priority !== testCase.priority) {
          updates.priority = priority;
        }

        if (Object.keys(updates).length > 0) {
          await testCasesApi.update(testCase.id, updates);
        }

        // 前提条件の差分更新
        await updateListItems(
          testCase.id,
          'precondition',
          preconditions,
          testCase.preconditions.map((p) => p.id)
        );

        // ステップの差分更新
        await updateListItems(
          testCase.id,
          'step',
          steps,
          testCase.steps.map((s) => s.id)
        );

        // 期待結果の差分更新
        await updateListItems(
          testCase.id,
          'expectedResult',
          expectedResults,
          testCase.expectedResults.map((e) => e.id)
        );

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
    _originalIds: string[]
  ) => {
    const api = {
      precondition: {
        add: testCasesApi.addPrecondition,
        update: testCasesApi.updatePrecondition,
        delete: testCasesApi.deletePrecondition,
        reorder: testCasesApi.reorderPreconditions,
      },
      step: {
        add: testCasesApi.addStep,
        update: testCasesApi.updateStep,
        delete: testCasesApi.deleteStep,
        reorder: testCasesApi.reorderSteps,
      },
      expectedResult: {
        add: testCasesApi.addExpectedResult,
        update: testCasesApi.updateExpectedResult,
        delete: testCasesApi.deleteExpectedResult,
        reorder: testCasesApi.reorderExpectedResults,
      },
    }[type];

    // 削除された項目を処理
    for (const item of items.filter((i) => i.isDeleted && !i.isNew)) {
      await api.delete(testCaseId, item.id);
    }

    // 新規追加された項目を処理
    const newItems: { tempId: string; realId: string }[] = [];
    for (const item of items.filter((i) => i.isNew && !i.isDeleted && i.content.trim())) {
      const result = await api.add(testCaseId, { content: item.content.trim() });
      const realId = 'precondition' in result
        ? result.precondition.id
        : 'step' in result
          ? result.step.id
          : result.expectedResult.id;
      newItems.push({ tempId: item.id, realId });
    }

    // 更新された項目を処理
    for (const item of items.filter(
      (i) => !i.isNew && !i.isDeleted && i.content.trim() !== i.originalContent
    )) {
      await api.update(testCaseId, item.id, { content: item.content.trim() });
    }

    // 並び順の更新
    const activeItems = items.filter((i) => !i.isDeleted && i.content.trim());
    if (activeItems.length > 0) {
      const orderedIds = activeItems.map((item) => {
        const newItem = newItems.find((n) => n.tempId === item.id);
        return newItem ? newItem.realId : item.id;
      });
      // 並び順が変わっている場合のみreorderを呼び出す
      const currentOrder = items
        .filter((i) => !i.isNew && !i.isDeleted)
        .map((i) => i.id);
      const hasOrderChanged =
        orderedIds.length !== currentOrder.length ||
        orderedIds.some((id, index) => id !== currentOrder[index]);

      if (hasOrderChanged || newItems.length > 0) {
        await api.reorder(testCaseId, orderedIds);
      }
    }
  };

  // リスト項目の追加
  const addListItem = (
    setter: React.Dispatch<React.SetStateAction<ListItem[]>>
  ) => {
    setter((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random()}`,
        content: '',
        isNew: true,
      },
    ]);
  };

  // リスト項目の更新
  const updateListItem = (
    setter: React.Dispatch<React.SetStateAction<ListItem[]>>,
    id: string,
    content: string
  ) => {
    setter((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item))
    );
  };

  // リスト項目の削除
  const deleteListItem = (
    setter: React.Dispatch<React.SetStateAction<ListItem[]>>,
    id: string
  ) => {
    setter((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isDeleted: true } : item
      )
    );
  };

  // ドラッグ終了時のハンドラ
  const handleDragEnd = useCallback(
    (
      event: DragEndEvent,
      items: ListItem[],
      setter: React.Dispatch<React.SetStateAction<ListItem[]>>
    ) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const activeItems = items.filter((i) => !i.isDeleted);
      const oldIndex = activeItems.findIndex((i) => i.id === active.id);
      const newIndex = activeItems.findIndex((i) => i.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      setter((prev) => {
        const activeItems = prev.filter((i) => !i.isDeleted);
        const deletedItems = prev.filter((i) => i.isDeleted);
        const reordered = arrayMove(activeItems, oldIndex, newIndex);
        return [...reordered, ...deletedItems];
      });
    },
    []
  );

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
          <label className="block text-sm font-medium text-foreground mb-1">
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
          <label className="block text-sm font-medium text-foreground mb-1">
            説明
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input w-full resize-none"
            rows={3}
            placeholder="テストケースの説明を入力..."
          />
        </div>

        {/* 優先度 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            優先度
          </label>
          <select
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

        {/* 前提条件 */}
        <DynamicListSection
          title="前提条件"
          items={preconditions.filter((i) => !i.isDeleted)}
          isExpanded={expandedSections.preconditions}
          onToggle={() => toggleSection('preconditions')}
          onAdd={() => addListItem(setPreconditions)}
          onUpdate={(id, content) => updateListItem(setPreconditions, id, content)}
          onDelete={(id) => deleteListItem(setPreconditions, id)}
          onDragEnd={(event) => handleDragEnd(event, preconditions, setPreconditions)}
          sensors={sensors}
          placeholder="前提条件を入力..."
        />

        {/* ステップ */}
        <DynamicListSection
          title="ステップ"
          items={steps.filter((i) => !i.isDeleted)}
          isExpanded={expandedSections.steps}
          onToggle={() => toggleSection('steps')}
          onAdd={() => addListItem(setSteps)}
          onUpdate={(id, content) => updateListItem(setSteps, id, content)}
          onDelete={(id) => deleteListItem(setSteps, id)}
          onDragEnd={(event) => handleDragEnd(event, steps, setSteps)}
          sensors={sensors}
          placeholder="ステップを入力..."
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
          onDragEnd={(event) => handleDragEnd(event, expectedResults, setExpectedResults)}
          sensors={sensors}
          placeholder="期待結果を入力..."
        />
      </div>

      {/* フッター */}
      <div className="flex-shrink-0 p-4 border-t border-border flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={isPending}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!title.trim() || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : mode === 'create' ? (
            sourceTestCaseId ? 'コピーして作成' : '作成'
          ) : (
            '保存'
          )}
        </button>
      </div>
    </form>
  );
}

/**
 * 動的リストセクション
 */
interface DynamicListSectionProps {
  title: string;
  items: ListItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
  placeholder: string;
}

function DynamicListSection({
  title,
  items,
  isExpanded,
  onToggle,
  onAdd,
  onUpdate,
  onDelete,
  onDragEnd,
  sensors,
  placeholder,
}: DynamicListSectionProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-background-tertiary hover:bg-background-secondary transition-colors text-sm font-medium text-foreground"
      >
        <span>
          {title}
          {items.length > 0 && (
            <span className="ml-2 text-foreground-muted">({items.length})</span>
          )}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* コンテンツ */}
      {isExpanded && (
        <div className="p-3 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item, index) => (
                <SortableListItem
                  key={item.id}
                  item={item}
                  index={index}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  placeholder={placeholder}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* 追加ボタン */}
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 text-sm text-accent hover:text-accent-hover"
          >
            <Plus className="w-4 h-4" />
            追加
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * ソート可能なリスト項目
 */
interface SortableListItemProps {
  item: ListItem;
  index: number;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  placeholder: string;
}

function SortableListItem({
  item,
  index,
  onUpdate,
  onDelete,
  placeholder,
}: SortableListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* ドラッグハンドル */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1 text-foreground-muted hover:text-foreground flex-shrink-0"
        aria-label="ドラッグして並び替え"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* 番号 */}
      <span className="text-sm text-foreground-muted w-6 flex-shrink-0">
        {index + 1}.
      </span>

      {/* 入力欄 */}
      <input
        type="text"
        value={item.content}
        onChange={(e) => onUpdate(item.id, e.target.value)}
        className="input flex-1"
        placeholder={placeholder}
      />

      {/* 削除ボタン */}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="p-1 text-foreground-muted hover:text-danger flex-shrink-0"
        aria-label="削除"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
