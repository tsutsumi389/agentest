# PiP画面 UI/UX改善計画

## 概要

テスト実施のPiP（Picture-in-Picture）画面のUI/UXを以下の要件に従って改善する。

## 変更要件

1. **ステータスボタンをフッターに固定**（「ステータス:」ラベルは削除）
2. **テストケース名の閉じるボタン（×）を削除**
3. **テストケース名をアコーディオン化**（説明を展開可能に、デフォルトは閉じた状態）
4. **ナビゲーションをヘッダーに統合**（`<<` `<` `>` `>>` ボタン形式）

## 変更後のレイアウト

```
┌────────────────────────────────────────────┐
│ [<<] [<]  テストケース 1/4  [>] [>>]       │ ← ヘッダー（4方向ナビ）
├────────────────────────────────────────────┤
│ ▶ テストケース名（クリックで説明展開）      │ ← アコーディオン
├────────────────────────────────────────────┤
│ [種類バッジ] 1/2                           │
│ コンテンツ...                              │ ← メインコンテンツ
│ ノート: ...                                │
├────────────────────────────────────────────┤
│     [未確認] [満たす] [満たさない]          │ ← フッター（ステータスのみ）
└────────────────────────────────────────────┘
```

## 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/components/execution/PipExecutionPanel.tsx` | UI構造の大幅変更 |
| `apps/web/src/pages/Execution.tsx` | 新規props（description）の受け渡し |

## 実装手順

### 1. PipExecutionPanel.tsx - Props追加

```typescript
interface PipExecutionPanelProps {
  // 既存props...
  testCaseDescription: string | null;  // 追加
}
```

### 2. PipExecutionPanel.tsx - ヘッダー変更

**現在:**
```
[< 前へ]  テストケース 1/4  [次へ >]
```

**変更後:**
```
[<<] [<]  テストケース 1/4  [>] [>>]
```

- `<<`: 前のテストケース（`onNavigateToTestCase('prev')`）
- `<`: 前のアイテム（`goToPrevious()`）
- `>`: 次のアイテム（`goToNext()`）
- `>>`: 次のテストケース（`onNavigateToTestCase('next')`）

### 3. PipExecutionPanel.tsx - テストケースタイトル行

**現在:**
- タイトル + 閉じるボタン（×）

**変更後:**
- 説明がある場合: アコーディオン形式（ChevronRight/ChevronDownアイコン + タイトル）
- 説明がない場合: タイトルのみ表示（アコーディオン無効化、アイコンなし）
- クリックで説明を展開/折りたたみ（説明がある場合のみ）
- デフォルトは閉じた状態
- 閉じるボタン削除

```typescript
const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
const hasDescription = !!testCaseDescription;
```

### 4. PipExecutionPanel.tsx - メインコンテンツ

- 「ステータス:」セクション（行506-536）を削除

### 5. PipExecutionPanel.tsx - フッター

**現在:**
```
[< 前へ]  全体: 1/9  [次へ >]
```

**変更後:**
```
[未確認] [満たす] [満たさない]
```

- ステータスボタンのみを配置（中央揃え）
- 進捗表示は削除
- ナビゲーションボタンは削除（ヘッダーに移動済み）

### 6. Execution.tsx - Props追加

2箇所のPipExecutionPanel呼び出しに`testCaseDescription`を追加：

```typescript
// 行517付近
testCaseDescription={pipTestCase.description}

// 行587付近
testCaseDescription={selectedTestCase.description}
```

## キーボード操作

既存のキーボードナビゲーション（矢印キー）は維持。

## 検証方法

1. Docker環境を起動: `cd docker && docker compose up`
2. ブラウザで `http://localhost:3000` にアクセス
3. テスト実行画面を開き、PiPモードを起動
4. 以下を確認:
   - ヘッダーに4つのナビゲーションボタン（<< < > >>）が表示される
   - テストケース名をクリックすると説明が展開/折りたたみされる（説明がある場合）
   - 説明がない場合はタイトルのみ表示（アコーディオンアイコンなし）
   - 閉じるボタンが存在しない
   - フッターにステータスボタンのみ表示される（進捗表示なし）
   - ステータスボタンクリック後、自動的に次のアイテムへ遷移する
