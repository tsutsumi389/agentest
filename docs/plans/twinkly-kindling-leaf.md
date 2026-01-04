# テストケース追加・編集・表示UI変更計画

## 概要
テストケースの追加・編集をモーダルではなく同一画面内フォームに変更し、表示時のモーダル感をなくす。

## 要件
1. **追加**: モーダル → 右パネルにフォーム表示
2. **編集**: インライン個別編集 → 全項目一括編集フォーム
3. **表示**: 現在のパネル構成を維持（モーダル感の除去）

---

## 変更対象ファイル

### 新規作成
| ファイル | 役割 |
|---------|------|
| `apps/web/src/components/test-case/TestCaseForm.tsx` | 作成・編集共通フォーム |

### 修正
| ファイル | 変更内容 |
|---------|----------|
| `apps/web/src/pages/TestSuiteDetail.tsx` | CreateTestCaseModal削除、フォーム表示ロジック追加 |
| `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` | 編集モード切り替え追加 |
| `apps/web/src/components/test-suite/TestCaseSidebar.tsx` | 作成モード時の表示調整 |

---

## 実装手順

### Step 1: TestCaseForm.tsx 作成
作成・編集で共用するフォームコンポーネント

```
Props:
- mode: 'create' | 'edit'
- testSuiteId: string
- projectId: string
- testCase?: TestCaseWithDetails (編集時)
- onSave: () => void
- onCancel: () => void
```

**フォーム項目:**
- タイトル（MentionInput使用 - @でテストケース参照維持）
- 説明
- 優先度（CRITICAL/HIGH/MEDIUM/LOW）
- 前提条件（動的リスト）
- ステップ（動的リスト）
- 期待結果（動的リスト）

**保存ロジック:**
- 作成時: testCasesApi.create() + 各項目を順次追加
- 編集時: 差分を検出して必要なAPIのみ呼び出し

### Step 2: TestSuiteDetail.tsx 修正

1. **CreateTestCaseModal削除** (445-684行目)
2. **URLパラメータで作成モード管理**
   ```
   ?mode=create → 右パネルにTestCaseFormを表示
   ```
3. **表示ロジック変更**
   ```tsx
   {searchParams.get('mode') === 'create' ? (
     <TestCaseForm mode="create" ... />
   ) : selectedTestCaseId ? (
     <TestCaseDetailPanel ... />
   ) : (
     // タブコンテンツ
   )}
   ```
4. **「テストケース追加」ボタン変更**
   - `setIsCreateModalOpen(true)` → `setSearchParams({ mode: 'create' })`

### Step 3: TestCaseDetailPanel.tsx 修正

1. **編集モード状態追加**
   ```tsx
   const [isEditMode, setIsEditMode] = useState(false);
   ```
2. **ヘッダーに「編集」ボタン追加**
3. **編集モード時の表示切り替え**
   ```tsx
   {isEditMode ? (
     <TestCaseForm mode="edit" testCase={testCase} ... />
   ) : (
     // 既存の表示（OverviewTab等）
   )}
   ```
4. **インライン編集コンポーネントを削除**
   - EditableTitle → 表示のみに変更
   - EditableDescription → 表示のみに変更
   - BasicInfoSection → 表示のみに変更（編集機能削除）
   - 全ての編集は「編集」ボタンからTestCaseFormへ

### Step 4: TestCaseSidebar.tsx 修正

1. **作成モード時の視覚的フィードバック**
   - 「+ 新規作成」ボタンのハイライト表示

---

## UI設計

### 作成フォーム表示時
```
┌────────────────┬─────────────────────────────────┐
│ テストケース   │ 新規テストケース作成             │
│ 一覧           │                                 │
│                │ [タイトル入力]                  │
│ [+ 新規作成]   │ [説明入力]                      │
│   (ハイライト) │ [優先度選択]                    │
│                │                                 │
│ ・ケース1      │ 前提条件                        │
│ ・ケース2      │ [+ 追加] [項目1] [項目2]...     │
│ ・ケース3      │                                 │
│                │ ステップ                        │
│                │ [+ 追加] [項目1] [項目2]...     │
│                │                                 │
│                │ 期待結果                        │
│                │ [+ 追加] [項目1] [項目2]...     │
│                │                                 │
│                │ [キャンセル] [保存]             │
└────────────────┴─────────────────────────────────┘
```

### 編集フォーム表示時
- 上記と同様のレイアウト
- 既存データがフォームに読み込まれた状態

### 表示モード（変更なし）
- 現在のTestCaseDetailPanelのレイアウトを維持
- ヘッダーに「編集」ボタンを追加

---

## 考慮事項

### 未保存警告
- フォーム編集中にナビゲーションしようとした場合の警告表示
- `beforeunload`イベントまたはReact Router のブロッキング

### APIコール最適化
- 編集時は差分のみ更新
- 作成時はテストケース作成後に各項目を順次追加（バックエンドに一括APIがないため）

### 既存機能の維持
- MentionInput（@でテストケース参照）
- コピー機能
- ドラッグ&ドロップ並び替え

---

## 実装の優先順位
1. TestCaseForm.tsx 作成（コア機能）
2. TestSuiteDetail.tsx 修正（作成フォーム統合）
3. TestCaseDetailPanel.tsx 修正（編集モード追加）
4. TestCaseSidebar.tsx 修正（UI調整）
