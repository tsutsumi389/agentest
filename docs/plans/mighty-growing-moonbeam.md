# テストスイート一覧の最終実行結果表示の変更

## 概要
テストスイート一覧で表示される最終実行結果を変更する。

**現在**: テスト実行のステータス（実行中/完了/中断）を表示
**変更後**: 環境名 + 各テストケース判定結果の数を表示

## 修正対象ファイル

### 1. バックエンド - リポジトリ型定義・クエリ変更
**ファイル**: `apps/api/src/repositories/test-suite.repository.ts`

- `TestSuiteSearchExecution` インターフェースを変更（行90-95）
  - `status` フィールドを削除
  - `environment: { id: string; name: string } | null` を追加
  - `judgmentCounts` オブジェクトを追加

- `search` メソッドのクエリ変更（行320-325）
  - `environment` リレーションを取得
  - `expectedResults` の `status` を取得

### 2. バックエンド - コントローラーのレスポンス整形
**ファイル**: `apps/api/src/controllers/project.controller.ts`

- `getTestSuites` メソッド（行223-259）で `expectedResults` を `judgmentCounts` に集計
- ヘルパー関数 `countJudgmentStatuses()` を追加

### 3. フロントエンド - 型定義更新
**ファイル**: `apps/web/src/lib/api.ts`

- `TestSuite.lastExecution` の型を変更（行321-326）
  - `status` フィールドを削除
  - `environment` と `judgmentCounts` を追加

### 4. フロントエンド - 表示コンポーネント変更
**ファイル**: `apps/web/src/pages/ProjectDetail.tsx`

- `TestSuiteRow` コンポーネント（行461-541）の表示変更
  - `executionStatusConfig` を削除
  - 環境名と判定結果カウントを表示する新しいUIに変更
  - 未使用のアイコンインポート削除（`CirclePlay`, `CheckCircle2`, `XCircle`）

## 表示形式

```
[テストスイート名] [ラベル]
N テストケース • [環境名] X成功 Y失敗 Z未実施 ...
```

- 0件のステータスは非表示
- 表示順: 成功 → 失敗 → 未実施 → スキップ → 実施不可

## 検証方法

1. `docker compose exec dev pnpm build` でビルド確認
2. ブラウザでプロジェクト詳細ページを開き、テストスイート一覧を確認
3. 環境と各判定結果の数が正しく表示されることを確認
