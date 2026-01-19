# テスト実行状況テーブルのリンク先修正計画

## 問題

`ExecutionStatusTable.tsx` のリンク先が間違っている。

**現在のリンク（間違い）:**
- 失敗中/スキップ中/テスト実行中: `/projects/${projectId}/executions/${lastExecutionId}`
- 未実施: `/projects/${projectId}/test-suites/${testSuiteId}`

**正しいリンク:**
- 失敗中/スキップ中/テスト実行中: `/executions/${lastExecutionId}`
- 未実施: `/test-suites/${testSuiteId}`

## 修正対象

`apps/web/src/components/project/dashboard/ExecutionStatusTable.tsx`

## 修正内容

4箇所のリンクを修正:

1. **168行目** (FailingSuitesList):
   - 現在: `linkTo={/projects/${projectId}/executions/${item.lastExecutionId}}`
   - 修正後: `linkTo={/executions/${item.lastExecutionId}}`

2. **207行目** (SkippedSuitesList):
   - 現在: `linkTo={/projects/${projectId}/executions/${item.lastExecutionId}}`
   - 修正後: `linkTo={/executions/${item.lastExecutionId}}`

3. **246行目** (NeverExecutedSuitesList):
   - 現在: `linkTo={/projects/${projectId}/test-suites/${item.testSuiteId}}`
   - 修正後: `linkTo={/test-suites/${item.testSuiteId}}`

4. **285行目** (InProgressSuitesList):
   - 現在: `linkTo={/projects/${projectId}/executions/${item.lastExecutionId}}`
   - 修正後: `linkTo={/executions/${item.lastExecutionId}}`

## 副作用

- `projectId` の変数がこれらの関数で使われなくなるため、各関数から `projectId` propsを削除できる（オプション）

## 検証方法

1. 開発サーバーで各タブのテストスイートをクリック
2. 失敗中/スキップ中/テスト実行中 → `/executions/{executionId}` に遷移することを確認
3. 未実施 → `/test-suites/{testSuiteId}` に遷移することを確認
