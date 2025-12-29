# CopyTestCaseModal 実装計画

## 概要

テストケースをコピーするためのモーダルコンポーネントを実装する。

## 対象要件

- TC-003: テストケースコピー

## 変更ファイル

| ファイル | 変更内容 |
|----------|----------|
| `apps/web/src/components/test-case/CopyTestCaseModal.tsx` | **新規作成** - コピーモーダル |
| `apps/web/src/components/test-case/index.ts` | エクスポート追加 |
| `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` | コピーボタン追加、モーダル統合 |
| `apps/web/src/lib/api.ts` | コピーAPIクライアントの修正（targetTestSuiteId対応） |

---

## 実装ステップ

### Step 1: CopyTestCaseModal.tsx 新規作成

**ファイル**: `apps/web/src/components/test-case/CopyTestCaseModal.tsx`

**参考パターン**: `TestCaseItemFormModal.tsx`

**機能要件**:
- モーダルダイアログ
- タイトル入力（デフォルト: `{元タイトル} のコピー`）
- バリデーション: タイトル必須、最大200文字
- コピー実行後、成功トースト表示
- ESCキー/背景クリックで閉じる
- ローディング状態表示

**Props設計**:
```typescript
interface CopyTestCaseModalProps {
  isOpen: boolean;
  testCase: TestCase;          // コピー元のテストケース
  testSuiteId: string;         // 現在のテストスイートID
  onClose: () => void;
  onCopied?: (newTestCase: TestCase) => void;
}
```

**UI構成**:
```
┌─────────────────────────────────────┐
│ テストケースをコピー           [×] │
├─────────────────────────────────────┤
│                                     │
│  コピー元: {testCase.title}         │
│                                     │
│  タイトル *                         │
│  ┌─────────────────────────────┐   │
│  │ {testCase.title} のコピー   │   │
│  └─────────────────────────────┘   │
│                                     │
│  前提条件、テスト手順、期待結果も   │
│  すべてコピーされます。             │
│                                     │
├─────────────────────────────────────┤
│                [キャンセル] [コピー]│
└─────────────────────────────────────┘
```

---

### Step 2: APIクライアント修正

**ファイル**: `apps/web/src/lib/api.ts`

**現在の定義**:
```typescript
copy: (testCaseId: string, data?: { title?: string }) =>
  api.post<{ testCase: TestCase }>(`/api/test-cases/${testCaseId}/copy`, data),
```

バックエンドの `copyTestCaseSchema` は `targetTestSuiteId` も受け付けるが、現時点では同一スイート内コピーのみ対応。将来の拡張のため型定義のみ追加:

```typescript
copy: (testCaseId: string, data?: { title?: string; targetTestSuiteId?: string }) =>
  api.post<{ testCase: TestCase }>(`/api/test-cases/${testCaseId}/copy`, data),
```

---

### Step 3: TestCaseDetailPanel.tsx にコピーボタン追加

**ファイル**: `apps/web/src/components/test-case/TestCaseDetailPanel.tsx`

**変更箇所**:

1. **インポート追加**:
   ```typescript
   import { Copy } from 'lucide-react';
   import { CopyTestCaseModal } from './CopyTestCaseModal';
   ```

2. **状態追加**:
   ```typescript
   const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
   ```

3. **ヘッダーにコピーボタン追加**（閉じるボタンの左側）:
   ```tsx
   {canEdit && (
     <button
       onClick={() => setIsCopyModalOpen(true)}
       className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
       aria-label="テストケースをコピー"
       title="テストケースをコピー"
     >
       <Copy className="w-5 h-5" />
     </button>
   )}
   ```

4. **モーダル追加**（コンポーネント最下部）:
   ```tsx
   <CopyTestCaseModal
     isOpen={isCopyModalOpen}
     testCase={testCase}
     testSuiteId={testSuiteId}
     onClose={() => setIsCopyModalOpen(false)}
     onCopied={(newTestCase) => {
       // キャッシュを更新
       queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
       toast.success('テストケースをコピーしました');
       setIsCopyModalOpen(false);
     }}
   />
   ```

---

### Step 4: エクスポート追加

**ファイル**: `apps/web/src/components/test-case/index.ts`

存在しない場合は作成:
```typescript
export { CopyTestCaseModal } from './CopyTestCaseModal';
export { TestCaseDetailPanel } from './TestCaseDetailPanel';
// ... 他のコンポーネント
```

---

## 実装詳細: CopyTestCaseModal.tsx

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, Copy } from 'lucide-react';
import { testCasesApi, ApiError, type TestCase } from '../../lib/api';
import { toast } from '../../stores/toast';

interface CopyTestCaseModalProps {
  isOpen: boolean;
  testCase: TestCase;
  testSuiteId: string;
  onClose: () => void;
  onCopied?: (newTestCase: TestCase) => void;
}

export function CopyTestCaseModal({
  isOpen,
  testCase,
  testSuiteId,
  onClose,
  onCopied,
}: CopyTestCaseModalProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルオープン時に初期値をセット
  useEffect(() => {
    if (isOpen) {
      setTitle(`${testCase.title} のコピー`);
      setError(null);
    }
  }, [isOpen, testCase.title]);

  // フォーカス設定
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [isOpen]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // バリデーション
  const validate = (): boolean => {
    if (!title.trim()) {
      setError('タイトルは必須です');
      return false;
    }
    if (title.length > 200) {
      setError('タイトルは200文字以内で入力してください');
      return false;
    }
    return true;
  };

  // コピー実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await testCasesApi.copy(testCase.id, { title: title.trim() });
      onCopied?.(response.testCase);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('コピーに失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 背景クリックでモーダルを閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">
              テストケースをコピー
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コピー元表示 */}
        <div className="mb-4 p-3 bg-background-secondary rounded-lg">
          <p className="text-xs text-foreground-muted mb-1">コピー元</p>
          <p className="text-sm font-medium text-foreground truncate">
            {testCase.title}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* タイトル */}
          <div>
            <label htmlFor="copy-title" className="block text-sm font-medium text-foreground mb-1">
              タイトル <span className="text-danger">*</span>
            </label>
            <input
              ref={titleInputRef}
              id="copy-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              className={`input w-full ${error ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
              placeholder="コピー後のタイトルを入力"
              disabled={isSubmitting}
            />
            {error && <p className="text-xs text-danger mt-1">{error}</p>}
          </div>

          {/* ヘルプテキスト */}
          <p className="text-xs text-foreground-subtle">
            前提条件、テスト手順、期待結果もすべてコピーされます。
          </p>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'コピー中...' : 'コピー'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## テスト観点

1. **正常系**
   - タイトル入力後コピー実行 → 新しいテストケースが作成される
   - コピー後、テストケースリストが更新される

2. **バリデーション**
   - 空のタイトル → エラー表示
   - 200文字超過 → エラー表示

3. **UX**
   - ESCキーでモーダルが閉じる
   - 背景クリックでモーダルが閉じる
   - 送信中はボタンが無効化される
   - デフォルトタイトルが「{元タイトル} のコピー」

4. **権限**
   - 編集権限がない場合、コピーボタンが表示されない
