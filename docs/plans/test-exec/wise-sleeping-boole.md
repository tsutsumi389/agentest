# Step 2: 手順・期待値記録UI (EX-004, EX-005) 実装計画

## 概要

テスト実行ページ（Execution.tsx）に、スナップショットに基づくテストケース表示と、前提条件/ステップ/期待値の結果更新UIを実装する。

## 設計方針

- アコーディオン形式でテストケースを表示（デフォルト：折りたたみ）
- ノート編集はインライン方式（テキストエリア展開）
- 一括ステータス変更は不要（個別変更のみ）
- 楽観的更新でレスポンシブなUX

---

## 実装ステップ

### Step 2.1: API層の拡張

**ファイル**: `apps/web/src/lib/api.ts`

`executionsApi`に結果更新メソッドを追加:

```typescript
updatePreconditionResult: (executionId, resultId, { status, note? }) => PATCH
updateStepResult: (executionId, resultId, { status, note? }) => PATCH
updateExpectedResult: (executionId, resultId, { status, note? }) => PATCH
```

---

### Step 2.2: ステータス設定ユーティリティ

**新規ファイル**: `apps/web/src/lib/execution-status.ts`

ステータスごとの色・アイコン・ラベル定義:

| ステータス種別 | ステータス値 | アイコン | 色 |
|--------------|-------------|---------|-----|
| Precondition | UNCHECKED | Circle | muted |
| Precondition | MET | CheckCircle2 | success |
| Precondition | NOT_MET | XCircle | danger |
| Step | PENDING | Circle | muted |
| Step | DONE | CheckCircle2 | success |
| Step | SKIPPED | MinusCircle | warning |
| Expected | PENDING | Circle | muted |
| Expected | PASS | CheckCircle2 | success |
| Expected | FAIL | XCircle | danger |
| Expected | SKIPPED | MinusCircle | warning |
| Expected | NOT_EXECUTABLE | Ban | accent |

---

### Step 2.3: 基本UIコンポーネント

#### 2.3.1 StatusButton

**新規ファイル**: `apps/web/src/components/execution/StatusButton.tsx`

- ステータスに応じた色・アイコンのボタン
- クリックでドロップダウン表示
- 選択肢はステータス種別ごとに定義

#### 2.3.2 InlineNoteEditor

**新規ファイル**: `apps/web/src/components/execution/InlineNoteEditor.tsx`

- 「ノートを追加」リンク → テキストエリア展開
- 保存/キャンセルボタン
- 最大2000文字

---

### Step 2.4: 結果アイテムコンポーネント

**新規ファイル**: `apps/web/src/components/execution/ExecutionResultItem.tsx`

汎用の結果表示アイテム:
- インデックス番号（丸いバッジ）
- 内容テキスト
- StatusButton
- InlineNoteEditor（展開時）
- 閲覧モード時はStatusButton無効化

Props:
```typescript
{
  index: number;
  content: string;
  status: string;
  note: string | null;
  statusOptions: StatusOption[];
  isEditable: boolean;
  isUpdating: boolean;
  onStatusChange: (status: string) => void;
  onNoteChange: (note: string) => void;
}
```

---

### Step 2.5: リストコンポーネント

#### 2.5.1 ExecutionPreconditionList

**新規ファイル**: `apps/web/src/components/execution/ExecutionPreconditionList.tsx`

- スナップショットの前提条件 + 結果データをマッピング
- snapshotPreconditionIdで紐付け
- セクションヘッダー付き

#### 2.5.2 ExecutionStepList

**新規ファイル**: `apps/web/src/components/execution/ExecutionStepList.tsx`

- ステップ一覧表示
- snapshotStepIdで結果とマッピング

#### 2.5.3 ExecutionExpectedResultList

**新規ファイル**: `apps/web/src/components/execution/ExecutionExpectedResultList.tsx`

- 期待結果一覧表示
- snapshotExpectedResultIdで結果とマッピング
- エビデンス表示は将来対応（Step 3）

---

### Step 2.6: アコーディオンコンポーネント

#### 2.6.1 ExecutionTestCaseItem

**新規ファイル**: `apps/web/src/components/execution/ExecutionTestCaseItem.tsx`

テストケースのアコーディオン表示:
- ヘッダー: テストケース名、優先度バッジ、進捗サマリー（PASS/FAIL/PENDING数）
- ChevronDown/Up で展開/折りたたみ
- 展開時:
  - ExecutionPreconditionList（テストケースレベル）
  - ExecutionStepList
  - ExecutionExpectedResultList

#### 2.6.2 ExecutionTestCaseList

**新規ファイル**: `apps/web/src/components/execution/ExecutionTestCaseList.tsx`

- テストケース一覧のレンダリング
- 各テストケースの結果データをフィルタリングして渡す

---

### Step 2.7: Execution.tsx 拡張

**ファイル**: `apps/web/src/pages/Execution.tsx`

1. **API変更**: `getById` → `getByIdWithDetails`
2. **サマリー計算**: expectedResultsからPASS/FAIL/SKIPPED/PENDING集計
3. **スイートレベル前提条件**: snapshotTestCaseId=nullの前提条件表示
4. **テストケース一覧**: ExecutionTestCaseList統合
5. **編集可否判定**: `status === 'IN_PROGRESS'`
6. **useMutationフック**: 各結果更新用の楽観的更新パターン

---

## ファイル一覧

| ファイル | 操作 |
|---------|------|
| `apps/web/src/lib/api.ts` | 編集: 更新API追加 |
| `apps/web/src/lib/execution-status.ts` | 新規 |
| `apps/web/src/components/execution/StatusButton.tsx` | 新規 |
| `apps/web/src/components/execution/InlineNoteEditor.tsx` | 新規 |
| `apps/web/src/components/execution/ExecutionResultItem.tsx` | 新規 |
| `apps/web/src/components/execution/ExecutionPreconditionList.tsx` | 新規 |
| `apps/web/src/components/execution/ExecutionStepList.tsx` | 新規 |
| `apps/web/src/components/execution/ExecutionExpectedResultList.tsx` | 新規 |
| `apps/web/src/components/execution/ExecutionTestCaseItem.tsx` | 新規 |
| `apps/web/src/components/execution/ExecutionTestCaseList.tsx` | 新規 |
| `apps/web/src/pages/Execution.tsx` | 大幅編集 |

---

## 実装順序

1. `api.ts` - 更新APIメソッド追加
2. `execution-status.ts` - ステータス設定
3. `StatusButton.tsx` - ステータス変更UI
4. `InlineNoteEditor.tsx` - ノート編集UI
5. `ExecutionResultItem.tsx` - 汎用アイテム
6. `ExecutionPreconditionList.tsx` - 前提条件リスト
7. `ExecutionStepList.tsx` - ステップリスト
8. `ExecutionExpectedResultList.tsx` - 期待結果リスト
9. `ExecutionTestCaseItem.tsx` - アコーディオン
10. `ExecutionTestCaseList.tsx` - 一覧
11. `Execution.tsx` - 統合・拡張

---

## エッジケース対応

- テストケース0件: 「テストケースがありません」表示
- 前提条件/ステップ/期待結果0件: セクション非表示
- スナップショットと結果の不整合: エラーログ出力、「---」表示
- 完了/中止後: 閲覧専用（StatusButton無効化）
- 楽観的更新失敗: ロールバック + toast通知
