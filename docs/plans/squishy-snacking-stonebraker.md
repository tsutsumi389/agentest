# テストスイート画面 UI/UX 変更計画

## 概要
テストスイート画面の「説明」と「前提条件」セクションのスタイルを「最近の実行履歴」と統一する。

## 変更内容

### 1. タイトルと内容の分離
**現在**: タイトルと内容が同じ `p-6` 内に配置
**変更後**: ヘッダーを `p-4 border-b border-border` で分離

### 2. 前提条件がない場合の表示をコンパクト化
**現在**: 大きなアイコン + `py-8` + 点線ボーダー
**変更後**: シンプルなテキスト `p-4 text-center text-foreground-muted`

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/web/src/pages/TestSuiteCases.tsx` | 説明セクションのスタイル変更 |
| `apps/web/src/components/test-suite/PreconditionList.tsx` | 前提条件セクションのスタイル変更 |

---

## 詳細な変更

### 1. TestSuiteCases.tsx - 説明セクション（行466-473）

```tsx
// 現在
<div className="card p-6">
  <h2 className="text-lg font-semibold text-foreground mb-4">説明</h2>
  {description ? <MarkdownPreview /> : <p>説明なし</p>}
</div>

// 変更後
<div className="card">
  <div className="p-4 border-b border-border">
    <h2 className="font-semibold text-foreground">説明</h2>
  </div>
  {description ? (
    <div className="p-4"><MarkdownPreview /></div>
  ) : (
    <div className="p-4 text-center text-foreground-muted">説明なし</div>
  )}
</div>
```

### 2. PreconditionList.tsx - 前提条件セクション

#### インポート変更
- `ClipboardList` アイコンを削除（不要になるため）

#### ローディング状態（行58-67）
```tsx
// 変更後
<div className="card">
  <div className="p-4 border-b border-border">
    <h2 className="font-semibold text-foreground">前提条件</h2>
  </div>
  <div className="flex items-center justify-center p-6">
    <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
  </div>
</div>
```

#### エラー状態（行69-81）
```tsx
// 変更後
<div className="card">
  <div className="p-4 border-b border-border">
    <h2 className="font-semibold text-foreground">前提条件</h2>
  </div>
  <div className="text-center p-6">
    <p className="text-danger mb-4">{error}</p>
    <button>再読み込み</button>
  </div>
</div>
```

#### 通常状態（行83-136）
```tsx
// 変更後
<div className="card">
  <CommentableField>
    <div className="p-4 border-b border-border">
      <h2 className="font-semibold text-foreground">前提条件</h2>
    </div>
    {preconditions.length === 0 ? (
      <div className="p-4 text-center text-foreground-muted">
        前提条件が設定されていません
      </div>
    ) : (
      <div className="p-4 space-y-2">
        {/* 前提条件リスト */}
      </div>
    )}
  </CommentableField>
</div>
```

---

## 実装手順

1. `PreconditionList.tsx` を編集
   - インポートから `ClipboardList` を削除
   - ローディング・エラー・通常状態のスタイルを変更

2. `TestSuiteCases.tsx` を編集
   - 説明セクションのスタイルを変更

---

## 検証方法

1. テストスイート詳細画面を開く
2. 以下のパターンを確認:
   - 説明あり/なし
   - 前提条件あり/なし
3. 「最近の実行履歴」との見た目の整合性を確認
