import { useState, useCallback, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import {
  testSuitesApi,
  ApiError,
  type TestSuite,
  type Precondition,
} from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  DynamicListSection,
  useDndSensors,
  createDragEndHandler,
  type ListItem,
} from '../common/DynamicListSection';
import { MarkdownEditor } from '../common/markdown';

/**
 * ステータスオプション
 */
const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '下書き' },
  { value: 'ACTIVE', label: 'アクティブ' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
] as const;

/**
 * 文字数制限
 */
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

interface TestSuiteFormProps {
  /** フォームモード */
  mode: 'create' | 'edit';
  /** プロジェクトID（作成時に必須） */
  projectId: string;
  /** 編集対象のテストスイート（編集時に必須） */
  testSuite?: TestSuite;
  /** 前提条件一覧（編集時に使用） */
  preconditions?: Precondition[];
  /** 保存完了時のコールバック（作成時は作成されたIDを渡す） */
  onSave: (createdTestSuiteId?: string) => void;
  /** キャンセル時のコールバック */
  onCancel: () => void;
}

/**
 * テストスイート編集・作成フォーム
 */
export function TestSuiteForm({
  mode,
  projectId,
  testSuite,
  preconditions: initialPreconditions,
  onSave,
  onCancel,
}: TestSuiteFormProps) {
  const isCreateMode = mode === 'create';

  // フォーム値の状態（作成時は空、編集時は既存値）
  const [name, setName] = useState(testSuite?.name || '');
  const [description, setDescription] = useState(testSuite?.description || '');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>(testSuite?.status || 'DRAFT');

  // 前提条件の状態（作成時は空配列、編集時は既存値）
  const [preconditions, setPreconditions] = useState<ListItem[]>(
    initialPreconditions?.map((p) => ({
      id: p.id,
      content: p.content,
      originalContent: p.content,
    })) || []
  );

  // セクションの展開状態
  const [expandedSections, setExpandedSections] = useState({
    preconditions: true,
  });

  // 保存処理の状態
  const [isSaving, setIsSaving] = useState(false);

  // dnd-kit センサー設定
  const sensors = useDndSensors();

  // フォームに変更があるかどうかを判定
  const hasChanges = useMemo(() => {
    if (isCreateMode) {
      // 作成モード: 何か入力があれば変更ありと判定
      const hasName = name.trim().length > 0;
      const hasDescription = description.trim().length > 0;
      const hasPreconditions = preconditions.filter((p) => !p.isDeleted && p.content.trim()).length > 0;
      return hasName || hasDescription || hasPreconditions;
    }

    // 編集モード: 既存値との比較
    const nameChanged = name.trim() !== (testSuite?.name || '');
    const descriptionChanged = description.trim() !== (testSuite?.description || '');
    const statusChanged = status !== (testSuite?.status || 'DRAFT');

    // 前提条件の変更チェック
    const activePreconditions = preconditions.filter((p) => !p.isDeleted);
    const originalPreconditions = initialPreconditions || [];
    const preconditionsChanged =
      activePreconditions.length !== originalPreconditions.length ||
      activePreconditions.some((p, i) => {
        if (p.isNew) return true;
        const original = originalPreconditions[i];
        return !original || p.content.trim() !== original.content;
      });

    return nameChanged || descriptionChanged || statusChanged || preconditionsChanged;
  }, [isCreateMode, testSuite, name, description, status, preconditions, initialPreconditions]);

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

  // フォーム送信ハンドラ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      toast.error('名前を入力してください');
      return;
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      toast.error(`名前は${MAX_NAME_LENGTH}文字以内で入力してください`);
      return;
    }

    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`説明は${MAX_DESCRIPTION_LENGTH}文字以内で入力してください`);
      return;
    }

    setIsSaving(true);

    try {
      if (isCreateMode) {
        // 作成モード
        const result = await testSuitesApi.create({
          projectId,
          name: trimmedName,
          description: trimmedDescription || undefined,
        });

        // 前提条件がある場合は並列で追加
        const activePreconditions = preconditions.filter((p) => !p.isDeleted && p.content.trim());
        if (activePreconditions.length > 0) {
          const groupId = crypto.randomUUID();
          await Promise.all(
            activePreconditions.map((item) =>
              testSuitesApi.addPrecondition(result.testSuite.id, {
                content: item.content.trim(),
                groupId,
              })
            )
          );
        }

        toast.success('テストスイートを作成しました');
        onSave(result.testSuite.id);
      } else {
        // 編集モード
        // 複数の変更をグループ化するためのgroupIdを生成
        const groupId = crypto.randomUUID();

        // 基本情報の更新
        const updates: { name?: string; description?: string; status?: string; groupId?: string } = {};
        if (trimmedName !== (testSuite?.name || '')) {
          updates.name = trimmedName;
        }
        if (trimmedDescription !== (testSuite?.description || '')) {
          updates.description = trimmedDescription;
        }
        if (status !== (testSuite?.status || 'DRAFT')) {
          updates.status = status;
        }

        if (Object.keys(updates).length > 0) {
          updates.groupId = groupId;
          await testSuitesApi.update(testSuite!.id, updates);
        }

        // 前提条件の差分更新
        await updatePreconditions(groupId);

        toast.success('テストスイートを更新しました');
        onSave();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(isCreateMode ? '作成に失敗しました' : '保存に失敗しました');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 前提条件の差分更新（編集モード専用）
  const updatePreconditions = async (groupId: string) => {
    if (!testSuite) return;

    // 削除された項目を処理
    for (const item of preconditions.filter((i) => i.isDeleted && !i.isNew)) {
      await testSuitesApi.deletePrecondition(testSuite.id, item.id, { groupId });
    }

    // 新規追加された項目を処理
    const newItems: { tempId: string; realId: string }[] = [];
    for (const item of preconditions.filter((i) => i.isNew && !i.isDeleted && i.content.trim())) {
      const result = await testSuitesApi.addPrecondition(testSuite.id, { content: item.content.trim(), groupId });
      newItems.push({ tempId: item.id, realId: result.precondition.id });
    }

    // 更新された項目を処理
    for (const item of preconditions.filter(
      (i) => !i.isNew && !i.isDeleted && i.content.trim() !== i.originalContent
    )) {
      await testSuitesApi.updatePrecondition(testSuite.id, item.id, { content: item.content.trim(), groupId });
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
        await testSuitesApi.reorderPreconditions(testSuite.id, orderedIds, { groupId });
      }
    }
  };

  // リスト項目の追加
  const addListItem = useCallback(() => {
    setPreconditions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        content: '',
        isNew: true,
      },
    ]);
  }, []);

  // リスト項目の更新
  const updateListItem = useCallback((id: string, content: string) => {
    setPreconditions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item))
    );
  }, []);

  // リスト項目の削除
  const deleteListItem = useCallback((id: string) => {
    setPreconditions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isDeleted: true } : item
      )
    );
  }, []);

  // ドラッグ終了時のハンドラ
  const handleDragEnd = useMemo(
    () => createDragEndHandler(preconditions, setPreconditions),
    [preconditions]
  );

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
          {isCreateMode ? '新規テストスイート作成' : 'テストスイート編集'}
        </h2>
      </div>

      {/* フォーム本体 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 名前 */}
        <div>
          <label htmlFor="suite-name" className="block text-sm font-medium text-foreground mb-1">
            名前 <span className="text-danger">*</span>
          </label>
          <input
            id="suite-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder="テストスイートの名前"
            maxLength={MAX_NAME_LENGTH}
          />
          <p className="text-xs text-foreground-muted mt-1">
            {name.length}/{MAX_NAME_LENGTH}文字
          </p>
        </div>

        {/* 説明 */}
        <div>
          <label htmlFor="suite-description" className="block text-sm font-medium text-foreground mb-1">
            説明
          </label>
          <MarkdownEditor
            id="suite-description"
            value={description}
            onChange={setDescription}
            placeholder="テストスイートの説明を入力...（Markdown対応）"
            rows={3}
          />
          <p className="text-xs text-foreground-muted mt-1">
            {description.length}/{MAX_DESCRIPTION_LENGTH}文字
          </p>
        </div>

        {/* ステータス */}
        <div>
          <label htmlFor="suite-status" className="block text-sm font-medium text-foreground mb-1">
            ステータス
          </label>
          <select
            id="suite-status"
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
          placeholder="前提条件を入力...（Markdown対応）"
          useMarkdown
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
              {isCreateMode ? '作成中...' : '保存中...'}
            </>
          ) : (
            isCreateMode ? '作成' : '保存'
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
