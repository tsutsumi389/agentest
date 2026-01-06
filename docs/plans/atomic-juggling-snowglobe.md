# テストケース編集フォームへのステータス変更機能追加

## 概要
テストケースの編集フォームにステータス変更機能を追加し、詳細欄から優先度・ステータス表示を削除する。

## 変更ファイル

### 1. `apps/web/src/components/test-case/TestCaseForm.tsx`
ステータス選択UIを追加

**変更内容:**
- ステータス選択オプションの定義を追加（DRAFT/ACTIVE/ARCHIVED）
- ステータスのstate管理を追加（useState）
- 優先度セクションの下にステータス選択のselect要素を追加
- hasChangesのuseMemo内にステータス変更チェックを追加
- handleSubmit内の更新処理にステータスを含める

### 2. `apps/web/src/components/test-case/TestCaseDetailPanel.tsx`
OverviewTabから優先度・ステータス表示を削除

**変更内容:**
- `OverviewTab`コンポーネント内の「基本情報」セクション（優先度・ステータスのgrid）を削除
- 不要になったimport（PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS）を削除

## 実装詳細

### TestCaseForm.tsx への追加コード

```typescript
// ステータスオプション（優先度オプションの下に追加）
const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '下書き' },
  { value: 'ACTIVE', label: 'アクティブ' },
  { value: 'ARCHIVED', label: 'アーカイブ' },
] as const;

// state追加（priorityの下）
const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>(
  testCase?.status || 'DRAFT'
);

// hasChanges内にステータス変更チェック追加
const statusChanged = status !== testCase.status;

// handleSubmit内のupdates作成部分に追加
if (status !== testCase.status) {
  updates.status = status;
}
```

### TestCaseDetailPanel.tsx から削除するコード
- 230-247行目の「基本情報」grid（優先度・ステータス表示）
