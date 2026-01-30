# ダッシュボードに最近のテスト実行結果を表示

## 概要
メインダッシュボード（`/dashboard`）に、最近のテスト実行結果一覧セクションを追加する。

## 表示項目
- プロジェクト名
- テストスイート名
- テスト実行環境
- テストケースの結果（プログレスバー：成功/失敗/スキップ/未判定）

## UI設計

```
┌─────────────────────────────────────────────────────────────┐
│ 最近のテスト実行                                            │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ プロジェクト名 / テストスイート名                       │ │
│ │ 環境: Development                          3時間前     │ │
│ │ [████████████░░░░░░░░░░░] 80%                          │ │
│ │ ● 成功 8  ● 失敗 1  ● スキップ 1  ● 未判定 0          │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 実装ステップ

### Step 1: 型定義（packages/shared）
**ファイル**: `packages/shared/src/types/user-dashboard.ts`（新規作成）

```typescript
export interface RecentExecutionItem {
  executionId: string;
  projectId: string;
  projectName: string;
  testSuiteId: string;
  testSuiteName: string;
  environment: { id: string; name: string } | null;
  createdAt: string;
  judgmentCounts: {
    PASS: number;
    FAIL: number;
    PENDING: number;
    SKIPPED: number;
  };
}
```

### Step 2: バックエンドAPI
**新規エンドポイント**: `GET /api/users/:userId/recent-executions`

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/services/user.service.ts` | `getRecentExecutions()`メソッド追加 |
| `apps/api/src/controllers/user.controller.ts` | ハンドラ追加 |
| `apps/api/src/routes/users.ts` | ルート追加 |

**クエリロジック**:
1. ユーザーがアクセス可能なプロジェクトを取得（ProjectMember経由）
2. それらのプロジェクトの最近のExecution（10件）を取得
3. 各ExecutionのExecutionExpectedResultをステータス別に集計
4. プロジェクト名・テストスイート名・環境情報を含めて返却

### Step 3: フロントエンドAPI
**ファイル**: `apps/web/src/lib/api.ts`

- `RecentExecutionItem`型を追加
- `usersApi.getRecentExecutions(userId)`メソッドを追加

### Step 4: コンポーネント作成
**ファイル**: `apps/web/src/components/dashboard/RecentExecutionsList.tsx`（新規）

- 既存の`ProgressBar`コンポーネントを再利用
- クリックで実行詳細ページへ遷移（`/projects/:projectId/executions/:executionId`）
- 空状態・ローディング状態を適切に表示

### Step 5: ダッシュボードページ更新
**ファイル**: `apps/web/src/pages/Dashboard.tsx`

- `RecentExecutionsList`コンポーネントを「最近のプロジェクト」の下に追加

## 修正対象ファイル

| ファイル | 操作 |
|---------|------|
| `packages/shared/src/types/user-dashboard.ts` | 新規作成 |
| `packages/shared/src/index.ts` | エクスポート追加 |
| `apps/api/src/services/user.service.ts` | メソッド追加 |
| `apps/api/src/controllers/user.controller.ts` | ハンドラ追加 |
| `apps/api/src/routes/users.ts` | ルート追加 |
| `apps/web/src/lib/api.ts` | 型・メソッド追加 |
| `apps/web/src/components/dashboard/RecentExecutionsList.tsx` | 新規作成 |
| `apps/web/src/components/dashboard/index.ts` | 新規作成 |
| `apps/web/src/pages/Dashboard.tsx` | コンポーネント追加 |

## 検証方法

1. **API確認**: `GET /api/users/:userId/recent-executions`が正しくデータを返すこと
2. **UI確認**: ダッシュボードに最近のテスト実行一覧が表示されること
3. **プログレスバー**: 成功/失敗/スキップ/未判定が正しく色分けされること
4. **遷移確認**: 実行アイテムをクリックして詳細ページに遷移できること
5. **空状態**: 実行がない場合に適切なメッセージが表示されること
