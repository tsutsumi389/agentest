import { useState, useEffect } from 'react';
import { Loader2, ClipboardList, ListOrdered, CheckCircle, type LucideIcon } from 'lucide-react';
import {
  testCasesApi,
  ApiError,
  type TestCasePrecondition,
  type TestCaseStep,
  type TestCaseExpectedResult,
  type ReviewCommentWithReplies,
} from '../../lib/api';
import { MarkdownPreview } from '../common/markdown';
import { CommentableItem } from '../review/CommentableItem';
import { CommentableField } from '../review/CommentableField';

/** リスト項目の共通型 */
type ItemType = TestCasePrecondition | TestCaseStep | TestCaseExpectedResult;

/** リスト種別ごとの設定 */
interface ItemListConfig {
  title: string;
  targetField: 'PRECONDITION' | 'STEP' | 'EXPECTED_RESULT';
  emptyIcon: LucideIcon;
  emptyMessage: string;
  badgeClassName: string;
  errorMessage: string;
  fetchItems: (testCaseId: string) => Promise<ItemType[]>;
}

const ITEM_LIST_CONFIGS: Record<string, ItemListConfig> = {
  precondition: {
    title: '前提条件',
    targetField: 'PRECONDITION',
    emptyIcon: ClipboardList,
    emptyMessage: '前提条件が設定されていません',
    badgeClassName: 'bg-background-tertiary text-foreground-muted',
    errorMessage: '前提条件一覧の取得に失敗しました',
    fetchItems: async (testCaseId) => {
      const response = await testCasesApi.getPreconditions(testCaseId);
      return response.preconditions.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    },
  },
  step: {
    title: 'テスト手順',
    targetField: 'STEP',
    emptyIcon: ListOrdered,
    emptyMessage: 'テスト手順が設定されていません',
    badgeClassName: 'bg-accent/20 text-accent',
    errorMessage: 'ステップ一覧の取得に失敗しました',
    fetchItems: async (testCaseId) => {
      const response = await testCasesApi.getSteps(testCaseId);
      return response.steps.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    },
  },
  expectedResult: {
    title: '期待結果',
    targetField: 'EXPECTED_RESULT',
    emptyIcon: CheckCircle,
    emptyMessage: '期待結果が設定されていません',
    badgeClassName: 'bg-success/20 text-success',
    errorMessage: '期待結果一覧の取得に失敗しました',
    fetchItems: async (testCaseId) => {
      const response = await testCasesApi.getExpectedResults(testCaseId);
      return response.expectedResults.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    },
  },
};

interface TestCaseItemListProps {
  /** リスト種別 */
  type: 'precondition' | 'step' | 'expectedResult';
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialItems?: ItemType[];
  /** レビューコメント一覧 */
  comments?: ReviewCommentWithReplies[];
  /** 編集権限があるか */
  canEdit?: boolean;
  /** コメント追加時のコールバック */
  onCommentAdded?: () => void;
}

/**
 * テストケース項目一覧の汎用コンポーネント（表示のみ）
 * 前提条件・テスト手順・期待結果で共通のレイアウトを使用
 */
export function TestCaseItemList({
  type,
  testCaseId,
  initialItems,
  comments,
  canEdit,
  onCommentAdded,
}: TestCaseItemListProps) {
  const config = ITEM_LIST_CONFIGS[type];
  const [items, setItems] = useState<ItemType[]>(initialItems || []);
  const [isLoading, setIsLoading] = useState(!initialItems);
  const [error, setError] = useState<string | null>(null);

  // 項目一覧を取得
  useEffect(() => {
    if (initialItems) {
      setItems(initialItems);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await config.fetchItems(testCaseId);
        setItems(result);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(config.errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [testCaseId, initialItems, config]);

  const EmptyIcon = config.emptyIcon;

  if (isLoading) {
    return (
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{config.title}</h2>
        </div>
        <div className="px-4 py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{config.title}</h2>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-danger text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <CommentableField
      targetType="CASE"
      targetId={testCaseId}
      targetField={config.targetField}
      comments={comments}
      canEdit={canEdit}
      onCommentAdded={onCommentAdded}
    >
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{config.title}</h2>
        </div>

        {items.length === 0 ? (
          <div className="p-4 text-center py-6">
            <EmptyIcon className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-foreground-muted text-sm">{config.emptyMessage}</p>
          </div>
        ) : (
          <div>
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-4${index < items.length - 1 ? ' border-b border-border' : ''}`}
              >
                {/* 番号 */}
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${config.badgeClassName}`}
                >
                  {index + 1}
                </span>
                {/* 内容（CommentableItemでラップ） */}
                <CommentableItem
                  targetType="CASE"
                  targetId={testCaseId}
                  targetField={config.targetField}
                  itemId={item.id}
                  itemContent={item.content}
                  comments={comments}
                  canEdit={canEdit}
                  onCommentAdded={onCommentAdded}
                >
                  <div className="flex-1">
                    <MarkdownPreview content={item.content} />
                  </div>
                </CommentableItem>
              </div>
            ))}
          </div>
        )}
      </div>
    </CommentableField>
  );
}
