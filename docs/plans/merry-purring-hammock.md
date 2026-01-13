# レビューコメントフォームの改善

## 概要
レビューコメントの入力フォームに以下の2つの変更を加える：
1. **Markdown対応** - textarea → MarkdownEditor（Write/Previewタブ、ツールバー付き）
2. **アクションアイコン直接表示** - 3点リーダーのMenuDropdownを廃止し、返信アイコンの横に編集・削除・解決済みアイコンを並べる

---

## Phase 1: MarkdownEditorの拡張

**ファイル:** `apps/web/src/components/common/markdown/MarkdownEditor.tsx`

### 追加するprops
```typescript
interface MarkdownEditorProps {
  // 既存props...
  autoFocus?: boolean;       // 自動フォーカス（返信フォーム用）
  disabled?: boolean;        // 無効化状態
  onSubmit?: () => void;     // Ctrl+Enter送信用コールバック
}
```

### 変更内容
1. `autoFocus` prop追加 - マウント時にtextareaにフォーカス
2. `disabled` prop追加 - textareaのdisabled属性に反映
3. `onSubmit` prop追加 - Ctrl/Cmd+Enterで呼び出し
4. `handleKeyDown`内でCtrl+Enterのハンドリング追加

---

## Phase 2: ReviewCommentFormの更新

**ファイル:** `apps/web/src/components/review/ReviewCommentForm.tsx`

### 変更内容
1. `MarkdownEditor`をインポート
2. textareaを`MarkdownEditor`に置き換え
3. `textareaRef`を削除（MarkdownEditor内部で管理）
4. `onSubmit` propを使ってCtrl+Enter送信を実現
5. `rows`をcompactモードで調整（compact: 3、通常: 4）

---

## Phase 3: ReviewCommentEditorの更新

**ファイル:** `apps/web/src/components/review/ReviewCommentEditor.tsx`

### 変更内容
1. `MarkdownEditor`をインポート
2. textareaを`MarkdownEditor`に置き換え
3. `textareaRef`を削除
4. `autoFocus`を有効化

---

## Phase 4: ReviewCommentItemのアクションアイコン変更

**ファイル:** `apps/web/src/components/review/ReviewCommentItem.tsx`

### 削除する要素
- `MenuDropdown`コンポーネント（L331-404）
- `MenuItem`インターフェース（L31-36）
- `actionItems`配列（L177-208）
- `MoreVertical`アイコンのインポート

### 変更後のアクション部分（L222-236）
返信アイコンの横に以下のアイコンを直接表示：
- **返信** (Reply) - 既存
- **編集** (Pencil) - isAuthorの場合のみ
- **削除** (Trash2) - isAuthorの場合のみ、hover時に赤色
- **解決済み/未解決** (CheckCircle2/RotateCcw) - canEditの場合のみ

### ReplyItemも同様に変更
- MenuDropdownを削除し、編集・削除アイコンを直接表示

---

## Phase 5: InlineCommentThreadの更新

**ファイル:** `apps/web/src/components/review/InlineCommentThread.tsx`

### 削除する要素
- `MenuDropdown`コンポーネント（L328-403）
- `MenuItem`インターフェース（L21-27）
- `actionItems`配列（L199-226, L431-436）
- `MoreVertical`アイコンのインポート

### InlineCommentItem（L242-257）
MenuDropdownを直接アイコンボタンに置き換え

### InlineReplyItem（L448-450）
MenuDropdownを直接アイコンボタンに置き換え

---

## 修正対象ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `apps/web/src/components/common/markdown/MarkdownEditor.tsx` | 機能拡張 |
| `apps/web/src/components/review/ReviewCommentForm.tsx` | Markdown対応 |
| `apps/web/src/components/review/ReviewCommentEditor.tsx` | Markdown対応 |
| `apps/web/src/components/review/ReviewCommentItem.tsx` | アイコン直接表示 |
| `apps/web/src/components/review/InlineCommentThread.tsx` | アイコン直接表示 |

---

## 検証方法

1. **Markdown機能の確認**
   - レビューコメント新規作成でMarkdownエディタが表示される
   - Write/Previewタブ切り替えが動作する
   - ツールバー（太字、斜体、リスト等）が使用できる
   - Ctrl+Enterで送信できる
   - コメント編集時も同様にMarkdownエディタが表示される

2. **アクションアイコンの確認**
   - コメントヘッダーに返信・編集・削除・解決済みアイコンが表示される
   - 3点リーダー（MoreVertical）が表示されない
   - 各アイコンのクリックで対応するアクションが実行される
   - 権限に応じてアイコンが表示/非表示になる（編集・削除は投稿者のみ）
   - 返信にも編集・削除アイコンが表示される

3. **既存機能の確認**
   - 文字数制限（2000文字）が正常に動作する
   - Escapeでキャンセルが動作する
   - 返信フォームのコンパクトモードが動作する
