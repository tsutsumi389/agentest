# テストケースレイアウト修正計画

## 概要
テストケースのレイアウト（ヘッダーとコンテンツ）をテストスイートと同じ構造に統一する。

---

## 1. ヘッダーレイアウトの修正

### 対象ファイル
- `apps/web/src/components/test-suite/TestSuiteHeader.tsx`

### 現状
```
┌─ 1行目: パンくずリスト（プロジェクト > スイート > ケース名 + バッジ）
└─ 2行目: タブ ─────────────────── アクションボタン
```

### 変更後
```
┌─ 1行目: タイトル + バッジ ─── アクションボタン
└─ 2行目: タブのみ
```

### 修正箇所
- L100-134: パンくずリスト → タイトル+バッジ+アクションボタン
- L228-261: タブ行のアクションボタン削除（1行目に移動）

---

## 2. コンテンツレイアウトの修正（カード形式に統一）

### 対象ファイル
1. `apps/web/src/components/test-case/TestCaseDetailPanel.tsx` - OverviewTab内の説明セクション
2. `apps/web/src/components/test-case/TestCasePreconditionList.tsx`
3. `apps/web/src/components/test-case/TestCaseStepList.tsx`
4. `apps/web/src/components/test-case/TestCaseExpectedResultList.tsx`

### 現状（テストケース）
```tsx
<div className="space-y-2">
  <h3 className="text-sm font-semibold">説明</h3>
  <MarkdownPreview ... />
</div>
```

### 変更後（テストスイートと同じカード形式）
```tsx
<div className="card">
  <div className="p-4 border-b border-border">
    <h2 className="font-semibold text-foreground">説明</h2>
  </div>
  <div className="p-4">
    <MarkdownPreview ... />
  </div>
</div>
```

### 各コンポーネントの修正内容

#### TestCaseDetailPanel.tsx (OverviewTab内)
- 説明セクション: cardクラス + border-bヘッダーに変更

#### TestCasePreconditionList.tsx
- 外側を`card`でラップ
- ヘッダー行を`p-4 border-b border-border`に
- コンテンツを`p-4`でラップ

#### TestCaseStepList.tsx
- 外側を`card`でラップ
- ヘッダー行を`p-4 border-b border-border`に
- コンテンツを`p-4`でラップ

#### TestCaseExpectedResultList.tsx
- 外側を`card`でラップ
- ヘッダー行を`p-4 border-b border-border`に
- コンテンツを`p-4`でラップ

---

## 検証方法
1. Docker開発環境を起動
2. テストスイートページでテストケースを選択
3. 確認項目:
   - ヘッダーが「タイトル+アクション / タブ」構造になっている
   - 説明、前提条件、手順、期待結果がカード形式になっている
   - 項目名（ヘッダー）と内容が border で視覚的に区切られている
   - 各アクションボタンが正常に動作する
