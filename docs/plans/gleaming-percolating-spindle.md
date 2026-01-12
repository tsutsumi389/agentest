# レビュー機能の改善実装計画

## 要件概要

1. **テストスイートの説明にコメント可能にする**
2. **テストケースのレビュータブを削除**
3. **レビュータブでモーダルではなくインライン展開**
4. **概要タブにレビューコメント表示モードを追加**

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/components/test-suite/TestSuiteHeader.tsx` | TEST_CASE_TABSからreview削除 |
| `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` | レビュータブ関連コード削除 |
| `apps/web/src/components/review/ReviewDetailContent.tsx` | **新規作成**: モーダルから抽出 |
| `apps/web/src/components/review/ReviewDetailModal.tsx` | 新コンポーネント使用に変更 |
| `apps/web/src/components/review/ReviewPanel.tsx` | 一覧/詳細の切り替え表示に変更 |
| `apps/web/src/pages/TestSuiteCases.tsx` | OverviewTab拡張（説明+レビュー選択） |
| `apps/web/src/components/test-suite/OverviewReviewSelector.tsx` | **新規作成**: レビュー選択UI |

---

## 実装詳細

### Phase 1: テストケースのレビュータブ削除

**1.1 TestSuiteHeader.tsx**
```tsx
// 変更前（22-29行目）
export type TestCaseTabType = 'overview' | 'review' | 'history' | 'settings';
const TEST_CASE_TABS = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'review', label: 'レビュー', icon: MessageSquare },  // 削除
  { id: 'history', label: '履歴', icon: History },
  { id: 'settings', label: '設定', icon: Settings },
];

// 変更後
export type TestCaseTabType = 'overview' | 'history' | 'settings';
const TEST_CASE_TABS = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'history', label: '履歴', icon: History },
  { id: 'settings', label: '設定', icon: Settings },
];
```

**1.2 TestCaseDetailPanel.tsx**
- レビュータブの条件分岐を削除
- `ReviewCommentList`のインポートを削除

---

### Phase 2: ReviewDetailContentの抽出

**2.1 ReviewDetailContent.tsx（新規作成）**
- `ReviewDetailModal.tsx`から`ReviewDetailContent`と`CommentCard`を抽出
- 再利用可能な独立コンポーネントとして整理

```tsx
// apps/web/src/components/review/ReviewDetailContent.tsx
export function ReviewDetailContent({ review }: { review: ReviewWithDetails }) {
  // ReviewDetailModalから移動したロジック
}

export function CommentCard({ comment }: { comment: ReviewCommentWithReplies }) {
  // ReviewDetailModalから移動したロジック
}
```

**2.2 ReviewDetailModal.tsx**
- 新しい`ReviewDetailContent`をインポートして使用
- 後方互換性を維持

---

### Phase 3: レビュータブのインライン展開

**3.1 ReviewPanel.tsx**
- 一覧表示と詳細表示の切り替え形式に変更
- レビュー選択時: モーダルの内容をそのままタブ内に表示
- 戻るボタンで一覧に戻る

```tsx
export function ReviewPanel({ testSuiteId }: ReviewPanelProps) {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  // 選択されたレビューの詳細を取得
  const { data: reviewDetailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['review-detail', selectedReviewId],
    queryFn: () => reviewsApi.getById(selectedReviewId!),
    enabled: !!selectedReviewId,
  });

  // レビュー詳細表示モード
  if (selectedReviewId) {
    return (
      <div className="space-y-4">
        {/* ヘッダー（戻るボタン） */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedReviewId(null)}
            className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            レビュー一覧に戻る
          </button>
        </div>

        {/* レビュー詳細（モーダルと同じ内容） */}
        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : reviewDetailData?.review ? (
          <ReviewDetailContent review={reviewDetailData.review} />
        ) : null}
      </div>
    );
  }

  // レビュー一覧表示モード（既存のコードをそのまま使用）
  return (
    <div className="space-y-6">
      {/* ヘッダー・フィルター */}
      ...
      {/* レビュー一覧 */}
      <ReviewList
        reviews={reviews}
        isLoading={isLoadingReviews}
        onReviewClick={setSelectedReviewId}
      />
      {/* モーダルは削除 */}
    </div>
  );
}
```

**3.2 ReviewDetailModal.tsx**
- 他の場所で使用される可能性があるため維持
- 新しい`ReviewDetailContent`をインポートして使用

---

### Phase 4: 概要タブの拡張

**4.1 OverviewReviewSelector.tsx（新規作成）**
- 提出済みレビューの選択UI
- ドロップダウン形式でレビューを選択

```tsx
interface OverviewReviewSelectorProps {
  testSuiteId: string;
  selectedReviewId: string | null;
  onSelectReview: (reviewId: string | null) => void;
}

export function OverviewReviewSelector({ ... }: OverviewReviewSelectorProps) {
  // 提出済みレビュー一覧を取得
  const { data: reviewsData } = useQuery({
    queryKey: ['test-suite-reviews', testSuiteId],
    queryFn: () => reviewsApi.getByTestSuite(testSuiteId, { limit: 50 }),
  });

  return (
    <div className="flex items-center gap-2 p-3 bg-background-secondary rounded-lg">
      <MessageSquare className="w-4 h-4 text-foreground-muted" />
      <span className="text-sm text-foreground-muted">レビューコメント表示:</span>
      <select value={selectedReviewId || ''} onChange={...}>
        <option value="">なし</option>
        {/* レビュー一覧 */}
      </select>
    </div>
  );
}
```

**4.2 TestSuiteCases.tsx - OverviewTab拡張**
- 説明セクションを追加し`CommentableField`でラップ
- `OverviewReviewSelector`を追加
- 選択したレビューのコメントを表示

```tsx
interface OverviewTabProps {
  testSuiteId: string;
  description: string | null;  // 追加
  executions: { id: string; status: string; startedAt: string }[];
  currentRole: 'OWNER' | ProjectMemberRole | undefined;
}

function OverviewTab({ testSuiteId, description, executions, currentRole }: OverviewTabProps) {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const { currentReview, refreshReview } = useReviewSession();

  // 選択したレビューの詳細を取得
  const { data: selectedReviewData } = useQuery({
    queryKey: ['review-detail', selectedReviewId],
    queryFn: () => reviewsApi.getById(selectedReviewId!),
    enabled: !!selectedReviewId,
  });

  // 表示するコメント（レビュー選択時はそのレビュー、レビュー中は現在のセッション）
  const displayComments = selectedReviewId
    ? (selectedReviewData?.review?.comments || [])
    : (currentReview?.comments || []);

  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  return (
    <div className="space-y-6">
      {/* レビュー選択UI */}
      <OverviewReviewSelector
        testSuiteId={testSuiteId}
        selectedReviewId={selectedReviewId}
        onSelectReview={setSelectedReviewId}
      />

      {/* 説明セクション（コメント可能） */}
      <CommentableField
        targetType="SUITE"
        targetId={testSuiteId}
        targetField="DESCRIPTION"
        fieldContent={description || undefined}
        comments={displayComments}
        canEdit={canEdit}
        onCommentAdded={refreshReview}
      >
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">説明</h2>
          {description ? (
            <MarkdownPreview content={description} />
          ) : (
            <p className="text-foreground-muted">説明なし</p>
          )}
        </div>
      </CommentableField>

      {/* 前提条件セクション（既存） */}
      <PreconditionList
        testSuiteId={testSuiteId}
        canEdit={canEdit}
        comments={displayComments}
        onCommentAdded={refreshReview}
      />

      {/* 実行履歴（既存） */}
      ...
    </div>
  );
}
```

---

## 実装順序

1. **Phase 1**: テストケースのレビュータブ削除（独立した変更）
2. **Phase 2**: ReviewDetailContent抽出（Phase 3の準備）
3. **Phase 3**: ReviewPanelのインライン展開
4. **Phase 4**: 概要タブの拡張（説明コメント + レビュー選択）

---

## 検証方法

1. **テストケースのレビュータブ削除**
   - テストケースを選択してタブを確認（レビュータブがないこと）

2. **レビュータブのインライン展開**
   - テストスイートのレビュータブでレビューをクリック
   - モーダルではなく右側に詳細が展開されること
   - 閉じるボタンで詳細パネルが閉じること

3. **概要タブのレビューコメント表示**
   - 概要タブでレビュー選択ドロップダウンが表示されること
   - レビューを選択すると説明・前提条件にコメントが表示されること
   - 説明フィールドにコメントを追加できること（レビュー中）

4. **動作確認手順**
   ```bash
   cd docker && docker compose up
   # ブラウザで http://localhost:3000 にアクセス
   # テストスイートを開いて各機能を確認
   ```
