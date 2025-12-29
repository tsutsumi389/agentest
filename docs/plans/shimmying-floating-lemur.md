# Step 7: フロントエンド - サイドバーコンポーネント 実装計画

## 概要

テストスイート詳細ページ（TestSuiteDetail.tsx）に、テストケース一覧を表示するサイドバーコンポーネントを実装する。

## 新規作成ファイル

- `apps/web/src/components/test-suite/TestCaseSidebar.tsx`

## 修正ファイル

- `apps/web/src/pages/TestSuiteDetail.tsx` - サイドバー統合
- `apps/web/src/lib/api.ts` - reorderTestCases API追加

---

## 実装ステップ

### Step 1: API関数の追加 (api.ts)

`testSuitesApi`に`reorderTestCases`メソッドを追加:

```typescript
reorderTestCases: (testSuiteId: string, testCaseIds: string[]) =>
  api.post<{ testCases: TestCase[] }>(`/api/test-suites/${testSuiteId}/test-cases/reorder`, { testCaseIds }),
```

**変更箇所**: `apps/web/src/lib/api.ts:660` 付近（testSuitesApi内）

---

### Step 2: TestCaseSidebar.tsx 新規作成

**ファイル**: `apps/web/src/components/test-suite/TestCaseSidebar.tsx`

#### 2.1 Props定義

```typescript
interface TestCaseSidebarProps {
  testSuiteId: string;
  testCases: TestCase[];
  selectedTestCaseId: string | null;
  onSelect: (testCaseId: string) => void;
  onCreateClick: () => void;
  currentRole?: 'OWNER' | ProjectMemberRole;
  isLoading?: boolean;
}
```

#### 2.2 コンポーネント構造

```
TestCaseSidebar
├── ヘッダー（検索ボックス + 新規作成ボタン）
└── DndContext
    └── SortableContext
        └── SortableTestCaseItem[] （内部コンポーネント）
```

#### 2.3 主要機能

1. **テストケース一覧表示**
   - orderKeyでソートして表示
   - タイトル（truncate）+ 優先度ドット

2. **D&D実装**（`PreconditionList.tsx`を参考）
   - `useSensors`: PointerSensor (distance: 8), KeyboardSensor
   - `handleDragEnd`: オプティミスティック更新 + API呼び出し
   - エラー時ロールバック

3. **選択状態のハイライト**
   - `isSelected`でアクティブスタイル適用
   - `bg-accent-subtle text-accent`

4. **検索ボックス**
   - ローカルフィルタリング（title, description）

5. **新規作成ボタン**
   - 権限チェック（OWNER, ADMIN, WRITE）

#### 2.4 優先度スタイル

```typescript
const priorityStyles = {
  CRITICAL: { dot: 'bg-danger', label: '緊急' },
  HIGH: { dot: 'bg-warning', label: '高' },
  MEDIUM: { dot: 'bg-accent', label: '中' },
  LOW: { dot: 'bg-foreground-muted', label: '低' },
};
```

---

### Step 3: TestSuiteDetail.tsx 改修

#### 3.1 状態追加

```typescript
const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);
```

#### 3.2 サイドバー統合

`usePageSidebar()`を使用してサイドバーコンテンツを設定:

```typescript
import { usePageSidebar } from '../components/Layout';
import { TestCaseSidebar } from '../components/test-suite/TestCaseSidebar';

// コンポーネント内
const { setSidebarContent } = usePageSidebar();

useEffect(() => {
  if (!testSuiteId) return;

  setSidebarContent(
    <TestCaseSidebar
      testSuiteId={testSuiteId}
      testCases={testCases}
      selectedTestCaseId={selectedTestCaseId}
      onSelect={setSelectedTestCaseId}
      onCreateClick={() => setIsCreateModalOpen(true)}
      currentRole={currentRole}
      isLoading={isLoadingCases}
    />
  );

  return () => setSidebarContent(null);
}, [testSuiteId, testCases, selectedTestCaseId, currentRole, isLoadingCases]);
```

#### 3.3 概要タブの変更

- テストケース一覧セクションの削除（サイドバーに移動）
- 将来的にテストケース選択時の詳細表示を追加予定（Step 8）

---

## 参照ファイル

| ファイル | 参照内容 |
|----------|----------|
| `apps/web/src/components/test-suite/PreconditionList.tsx` | D&D実装パターン |
| `apps/web/src/components/Layout.tsx` | usePageSidebar フック |
| `apps/web/src/components/layout-parts/PageSidebar.tsx` | サイドバーUIコンポーネント |

---

## 注意事項

1. **検索時のD&D無効化**: 検索フィルタ適用中は並び替えを無効化
2. **オプティミスティック更新**: API失敗時は元の順序にロールバック
3. **権限チェック**: OWNER, ADMIN, WRITEのみD&Dと新規作成を許可
4. **ローディング状態**: 並び替え中、テストケース読み込み中の表示

---

## テスト観点

- [ ] テストケース一覧が正しく表示される
- [ ] D&Dで並び替えができる
- [ ] 並び替え後にAPIが呼ばれ、順序が保存される
- [ ] 選択状態がハイライトされる
- [ ] 検索でフィルタリングできる
- [ ] 権限がない場合はD&D/新規作成が非表示
- [ ] エラー時にロールバックされる
