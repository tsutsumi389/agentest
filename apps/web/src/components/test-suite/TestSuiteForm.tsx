import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  testSuitesApi,
  ApiError,
  type TestSuite,
  type Precondition,
} from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';

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
 * ステータスオプション
 */
const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '下書き' },
  { value: 'ACTIVE', label: 'アクティブ' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
] as const;

interface TestSuiteFormProps {
  /** フォームモード（現状は編集のみ） */
  mode: 'edit';
  /** 編集対象のテストスイート */
  testSuite: TestSuite;
  /** 前提条件一覧 */
  preconditions: Precondition[];
  /** 保存完了時のコールバック */
  onSave: () => void;
  /** キャンセル時のコールバック */
  onCancel: () => void;
}

/**
 * テストスイート編集フォーム
 */
export function TestSuiteForm({
  mode: _mode,
  testSuite,
  preconditions: initialPreconditions,
  onSave,
  onCancel,
}: TestSuiteFormProps) {
  // _modeは将来の拡張用（新規作成モード対応時に使用）
  const queryClient = useQueryClient();

  // フォーム値の状態
  const [name, setName] = useState(testSuite.name);
  const [description, setDescription] = useState(testSuite.description || '');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>(testSuite.status);

  // 前提条件の状態
  const [preconditions, setPreconditions] = useState<ListItem[]>(
    initialPreconditions.map((p) => ({
      id: p.id,
      content: p.content,
      originalContent: p.content,
    }))
  );

  // セクションの展開状態
  const [expandedSections, setExpandedSections] = useState({
    preconditions: true,
  });

  // 保存処理の状態
  const [isSaving, setIsSaving] = useState(false);

  // フォームに変更があるかどうかを判定
  const hasChanges = useMemo(() => {
    const nameChanged = name.trim() !== testSuite.name;
    const descriptionChanged = description.trim() !== (testSuite.description || '');
    const statusChanged = status !== testSuite.status;

    // 前提条件の変更チェック
    const activePreconditions = preconditions.filter((p) => !p.isDeleted);
    const preconditionsChanged =
      activePreconditions.length !== initialPreconditions.length ||
      activePreconditions.some((p, i) => {
        if (p.isNew) return true;
        const original = initialPreconditions[i];
        return !original || p.content.trim() !== original.content;
      });

    return nameChanged || descriptionChanged || statusChanged || preconditionsChanged;
  }, [testSuite, name, description, status, preconditions, initialPreconditions]);

  // キャンセル確認ダイアログの状態
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // ブラウザの閉じる/リロード警告
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges && !isSaving) {
        e.preventDefault();
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

  // フォーム送信ハンドラ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    setIsSaving(true);

    try {
      // 基本情報の更新
      const updates: { name?: string; description?: string; status?: string } = {};
      if (name.trim() !== testSuite.name) {
        updates.name = name.trim();
      }
      if (description.trim() !== (testSuite.description || '')) {
        updates.description = description.trim();
      }
      if (status !== testSuite.status) {
        updates.status = status;
      }

      if (Object.keys(updates).length > 0) {
        await testSuitesApi.update(testSuite.id, updates);
      }

      // 前提条件の差分更新
      await updatePreconditions();

      queryClient.invalidateQueries({ queryKey: ['test-suite', testSuite.id] });
      queryClient.invalidateQueries({ queryKey: ['test-suite-preconditions', testSuite.id] });
      toast.success('テストスイートを更新しました');
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

  // 前提条件の差分更新
  const updatePreconditions = async () => {
    // 削除された項目を処理
    for (const item of preconditions.filter((i) => i.isDeleted && !i.isNew)) {
      await testSuitesApi.deletePrecondition(testSuite.id, item.id);
    }

    // 新規追加された項目を処理
    const newItems: { tempId: string; realId: string }[] = [];
    for (const item of preconditions.filter((i) => i.isNew && !i.isDeleted && i.content.trim())) {
      const result = await testSuitesApi.addPrecondition(testSuite.id, { content: item.content.trim() });
      newItems.push({ tempId: item.id, realId: result.precondition.id });
    }

    // 更新された項目を処理
    for (const item of preconditions.filter(
      (i) => !i.isNew && !i.isDeleted && i.content.trim() !== i.originalContent
    )) {
      await testSuitesApi.updatePrecondition(testSuite.id, item.id, { content: item.content.trim() });
    }

    // 並び順の更新
    const activeItems = preconditions.filter((i) => !i.isDeleted && i.content.trim());
    if (activeItems.length > 0) {
      const orderedIds = activeItems.map((item) => {
        const newItem = newItems.find((n) => n.tempId === item.id);
        return newItem ? newItem.realId : item.id;
      });
      // 並び順が変わっている場合のみreorderを呼び出す
      const currentOrder = preconditions
        .filter((i) => !i.isNew && !i.isDeleted)
        .map((i) => i.id);
      const hasOrderChanged =
        orderedIds.length !== currentOrder.length ||
        orderedIds.some((id, index) => id !== currentOrder[index]);

      if (hasOrderChanged || newItems.length > 0) {
        await testSuitesApi.reorderPreconditions(testSuite.id, orderedIds);
      }
    }
  };

  // リスト項目の追加
  const addListItem = () => {
    setPreconditions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        content: '',
        isNew: true,
      },
    ]);
  };

  // リスト項目の更新
  const updateListItem = (id: string, content: string) => {
    setPreconditions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item))
    );
  };

  // リスト項目の削除
  const deleteListItem = (id: string) => {
    setPreconditions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isDeleted: true } : item
      )
    );
  };

  // ドラッグ終了時のハンドラ
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setPreconditions((prev) => {
      const activeItems = prev.filter((i) => !i.isDeleted);
      const deletedItems = prev.filter((i) => i.isDeleted);
      const oldIndex = activeItems.findIndex((i) => i.id === active.id);
      const newIndex = activeItems.findIndex((i) => i.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return prev;
      }

      const reordered = arrayMove(activeItems, oldIndex, newIndex);
      return [...reordered, ...deletedItems];
    });
  }, []);

  // セクション展開/折りたたみのトグル
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          テストスイート編集
        </h2>
      </div>

      {/* フォーム本体 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 名前 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            名前 <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder="テストスイートの名前"
            maxLength={100}
          />
          <p className="text-xs text-foreground-muted mt-1">
            {name.length}/100文字
          </p>
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
            placeholder="テストスイートの説明を入力..."
            maxLength={500}
          />
          <p className="text-xs text-foreground-muted mt-1">
            {description.length}/500文字
          </p>
        </div>

        {/* ステータス */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            ステータス
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="input"
          >
            {STATUS_OPTIONS.map((option) => (
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
          onAdd={addListItem}
          onUpdate={updateListItem}
          onDelete={deleteListItem}
          onDragEnd={handleDragEnd}
          sensors={sensors}
          placeholder="前提条件を入力..."
        />
      </div>

      {/* フッター */}
      <div className="flex-shrink-0 p-4 border-t border-border flex justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="btn btn-secondary"
          disabled={isSaving}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!name.trim() || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
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
