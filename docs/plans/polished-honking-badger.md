# Step 8: テストケース詳細パネル 実装計画

## 概要

テストケースをサイドバーで選択した際に、メインコンテンツエリアに表示する詳細パネルを実装する。

## ファイル構成

```
apps/web/src/components/test-case/
├── TestCaseDetailPanel.tsx        # メインパネル
├── TestCasePreconditionList.tsx   # 前提条件リスト (D&D)
├── TestCaseStepList.tsx           # ステップリスト (D&D)
├── TestCaseExpectedResultList.tsx # 期待結果リスト (D&D)
├── TestCaseHistoryList.tsx        # 履歴タイムライン
├── TestCaseItemFormModal.tsx      # 汎用フォームモーダル
└── DeleteTestCaseSection.tsx      # 削除セクション
```

---

## 実装手順

### Step 1: api.ts への型とメソッド追加

**ファイル:** `apps/web/src/lib/api.ts`

追加する型:
- `TestCasePrecondition` - 前提条件
- `TestCaseStep` - ステップ
- `TestCaseExpectedResult` - 期待結果
- `TestCaseChangeType` - 変更タイプ
- `TestCaseHistory` - 履歴
- `TestCaseWithDetails` - 詳細（extends TestCase）

追加するAPI:
```typescript
testCasesApi = {
  // 既存...
  getByIdWithDetails,
  // 前提条件CRUD + reorder
  getPreconditions, addPrecondition, updatePrecondition, deletePrecondition, reorderPreconditions,
  // ステップCRUD + reorder
  getSteps, addStep, updateStep, deleteStep, reorderSteps,
  // 期待結果CRUD + reorder
  getExpectedResults, addExpectedResult, updateExpectedResult, deleteExpectedResult, reorderExpectedResults,
  // 履歴・コピー・復元
  getHistories, copy, restore,
}
```

---

### Step 2: TestCaseItemFormModal.tsx（汎用フォームモーダル）

**ファイル:** `apps/web/src/components/test-case/TestCaseItemFormModal.tsx`

- PreconditionFormModal.tsx と同様のパターン
- title, placeholder, initialValue を props で受け取る
- 作成・編集両方に対応

---

### Step 3: TestCasePreconditionList.tsx（前提条件リスト）

**ファイル:** `apps/web/src/components/test-case/TestCasePreconditionList.tsx`

参照実装: `apps/web/src/components/test-suite/PreconditionList.tsx`

機能:
- D&D対応（dnd-kit）
- オプティミスティック更新
- 追加/編集/削除
- ActionDropdown

---

### Step 4: TestCaseStepList.tsx（ステップリスト）

**ファイル:** `apps/web/src/components/test-case/TestCaseStepList.tsx`

TestCasePreconditionList と同一構造で実装。

---

### Step 5: TestCaseExpectedResultList.tsx（期待結果リスト）

**ファイル:** `apps/web/src/components/test-case/TestCaseExpectedResultList.tsx`

TestCasePreconditionList と同一構造で実装。

---

### Step 6: TestCaseHistoryList.tsx（履歴タイムライン）

**ファイル:** `apps/web/src/components/test-case/TestCaseHistoryList.tsx`

参照実装: `apps/web/src/components/test-suite/TestSuiteHistoryList.tsx`

機能:
- ページネーション付き履歴取得
- タイムライン形式表示
- 変更タイプ別アイコン・色

---

### Step 7: DeleteTestCaseSection.tsx（削除セクション）

**ファイル:** `apps/web/src/components/test-case/DeleteTestCaseSection.tsx`

参照実装: `apps/web/src/components/test-suite/DeleteTestSuiteSection.tsx`

機能:
- 削除確認ダイアログ
- 復元機能（削除済みの場合）
- 権限チェック

---

### Step 8: TestCaseDetailPanel.tsx（メインパネル）

**ファイル:** `apps/web/src/components/test-case/TestCaseDetailPanel.tsx`

Props:
```typescript
interface TestCaseDetailPanelProps {
  testCaseId: string;
  testSuiteId: string;
  currentRole?: 'OWNER' | ProjectMemberRole;
  onClose: () => void;
  onUpdated?: (testCase: TestCase) => void;
  onDeleted?: () => void;
}
```

構造:
```
TestCaseDetailPanel
├── ヘッダー（タイトル編集、閉じるボタン）
├── 優先度・ステータスバッジ
├── タブナビゲーション（概要/履歴/設定）
└── タブコンテンツ
    ├── 概要タブ
    │   ├── 基本情報（説明、優先度、ステータス）
    │   ├── TestCasePreconditionList
    │   ├── TestCaseStepList
    │   └── TestCaseExpectedResultList
    ├── 履歴タブ → TestCaseHistoryList
    └── 設定タブ → DeleteTestCaseSection
```

---

### Step 9: TestSuiteDetail.tsx 統合

**ファイル:** `apps/web/src/pages/TestSuiteDetail.tsx`

変更内容:
1. selectedTestCaseId がある時、詳細パネルをフル幅で表示（概要タブは非表示）
2. テストケース未選択時は既存の概要タブを表示
3. キャッシュ無効化（更新・削除時）

レイアウト:
```tsx
{/* テストケース選択時: 詳細パネルのみ表示 */}
{selectedTestCaseId ? (
  <div className="card h-[calc(100vh-16rem)] overflow-hidden">
    <TestCaseDetailPanel
      testCaseId={selectedTestCaseId}
      testSuiteId={testSuiteId}
      currentRole={currentRole}
      onClose={() => setSelectedTestCaseId(null)}
      onUpdated={(testCase) => {
        queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
      }}
      onDeleted={() => {
        setSelectedTestCaseId(null);
        queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
      }}
    />
  </div>
) : (
  /* テストケース未選択時: 既存の概要/履歴/設定タブを表示 */
  <>
    {currentTab === 'overview' && <OverviewTab ... />}
    {currentTab === 'history' && <TestSuiteHistoryList ... />}
    {currentTab === 'settings' && <SettingsTab ... />}
  </>
)}
```

---

## 主要ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `apps/web/src/lib/api.ts` | 修正 |
| `apps/web/src/pages/TestSuiteDetail.tsx` | 修正 |
| `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` | 新規 |
| `apps/web/src/components/test-case/TestCasePreconditionList.tsx` | 新規 |
| `apps/web/src/components/test-case/TestCaseStepList.tsx` | 新規 |
| `apps/web/src/components/test-case/TestCaseExpectedResultList.tsx` | 新規 |
| `apps/web/src/components/test-case/TestCaseHistoryList.tsx` | 新規 |
| `apps/web/src/components/test-case/TestCaseItemFormModal.tsx` | 新規 |
| `apps/web/src/components/test-case/DeleteTestCaseSection.tsx` | 新規 |

## 参照実装

- D&Dリスト: `apps/web/src/components/test-suite/PreconditionList.tsx`
- 履歴表示: `apps/web/src/components/test-suite/TestSuiteHistoryList.tsx`
- 削除セクション: `apps/web/src/components/test-suite/DeleteTestSuiteSection.tsx`
- フォームモーダル: `apps/web/src/components/test-suite/PreconditionFormModal.tsx`
