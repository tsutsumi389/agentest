# レビューコメントUI改善プラン

## 概要
レビュー画面のコメント表示の幅問題を修正し、手順・期待結果セクション全体へのコメント機能を追加する。

## 問題点

### 1. コメント表示の幅が狭い
- `CommentableItem.tsx`で`ml-9`(36px)の固定左マージンが使われており、コメント表示領域が狭くなっている
- 該当箇所:
  - L142: 未解決コメント表示 `<div className="mt-2 ml-9 space-y-2">`
  - L192: インラインフォーム `<div className="mt-3 ml-9 p-3 ...>`
  - L206: インラインコメント `<div className="ml-9">`

### 2. 手順・期待結果が空の場合にコメントできない
- `TestCaseStepList.tsx`: `CommentableField`でラップされていない
- `TestCaseExpectedResultList.tsx`: `CommentableField`でラップされていない
- `PreconditionList.tsx`は正しく`CommentableField`でラップ済み（参考実装）

## 修正内容

### ファイル1: `apps/web/src/components/review/CommentableItem.tsx`
**幅の修正** - `ml-9`を削除して全幅表示に

```diff
- <div className="mt-2 ml-9 space-y-2">
+ <div className="mt-2 space-y-2">

- <div className="mt-3 ml-9 p-3 bg-background-secondary rounded-lg border border-border">
+ <div className="mt-3 p-3 bg-background-secondary rounded-lg border border-border">

- <div className="ml-9">
+ <div>
```

### ファイル2: `apps/web/src/components/test-case/TestCaseStepList.tsx`
**セクション全体へのコメント機能追加** - `CommentableField`でラップ

- `CommentableField`をインポート
- セクション全体を`CommentableField`でラップ（PreconditionList.tsxと同様の構造）
- 空の場合でもコメント可能に

### ファイル3: `apps/web/src/components/test-case/TestCaseExpectedResultList.tsx`
**セクション全体へのコメント機能追加** - `CommentableField`でラップ

- `CommentableField`をインポート
- セクション全体を`CommentableField`でラップ（PreconditionList.tsxと同様の構造）
- 空の場合でもコメント可能に

## 検証方法
1. Dockerコンテナを起動: `cd docker && docker compose up`
2. ブラウザでアプリにアクセス
3. レビューモードでテストケースを開く
4. 以下を確認:
   - インラインコメントが横幅いっぱいに表示されること
   - 手順セクション全体にコメントできること（ホバーでコメントボタン表示）
   - 期待結果セクション全体にコメントできること
   - 手順・期待結果が空の場合でもセクションにコメントできること
