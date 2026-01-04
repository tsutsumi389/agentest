import {
  Plus,
  Trash2,
  GripVertical,
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

/**
 * 動的リスト項目の型
 */
export interface ListItem {
  id: string;
  content: string;
  isNew?: boolean; // 新規追加された項目
  isDeleted?: boolean; // 削除された項目
  originalContent?: string; // 編集時の元の内容
}

/**
 * 動的リストセクションのprops
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

/**
 * 動的リストセクション
 * テストケース・テストスイートのフォームで使用する、
 * 項目の追加・編集・削除・並び替えが可能なセクション
 */
export function DynamicListSection({
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
 * ソート可能なリスト項目のprops
 */
interface SortableListItemProps {
  item: ListItem;
  index: number;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  placeholder: string;
}

/**
 * ソート可能なリスト項目
 */
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

/**
 * dnd-kit センサーを作成するカスタムフック
 */
export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}

/**
 * ドラッグ終了時のハンドラを生成するユーティリティ
 */
export function createDragEndHandler<T extends ListItem>(
  _items: T[],
  setter: React.Dispatch<React.SetStateAction<T[]>>
) {
  // _itemsは依存関係として渡されるが、実際の操作はsetterのコールバック内で最新のstateを使用する
  return (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setter((prev) => {
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
  };
}

/**
 * リスト項目を追加するユーティリティ
 */
export function addListItem<T extends ListItem>(
  setter: React.Dispatch<React.SetStateAction<T[]>>
) {
  setter((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      content: '',
      isNew: true,
    } as T,
  ]);
}

/**
 * リスト項目を更新するユーティリティ
 */
export function updateListItem<T extends ListItem>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  id: string,
  content: string
) {
  setter((prev) =>
    prev.map((item) => (item.id === id ? { ...item, content } : item))
  );
}

/**
 * リスト項目を削除するユーティリティ
 */
export function deleteListItem<T extends ListItem>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  id: string
) {
  setter((prev) =>
    prev.map((item) =>
      item.id === id ? { ...item, isDeleted: true } : item
    )
  );
}
