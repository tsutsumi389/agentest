# Step 1: 実行開始・環境選択 (EX-001, EX-002, EX-003) 詳細実装計画

## 概要

テスト実行開始時に環境を選択できるモーダルを追加し、権限チェックミドルウェアを実装する。

## 実装タスク

### 1. バックエンド: 権限ミドルウェア作成

**ファイル**: `apps/api/src/middleware/require-execution-role.ts` (新規作成)

実行IDからテストスイート→プロジェクトを辿って権限チェックを行う。

```typescript
// requireTestCaseRole()と同様のパターンで実装
export function requireExecutionRole(roles: ProjectRole[], options?: RequireExecutionRoleOptions)
```

**実装内容**:
- executionId からExecution → TestSuite → Projectを取得
- プロジェクトメンバーシップをチェック
- OWNERは全権限
- 組織メンバーの場合、OWNER/ADMINは全権限
- `req.params`にprojectId, testSuiteIdを設定

**参考**: `apps/api/src/middleware/require-test-case-role.ts`

---

### 2. バックエンド: ExecutionService拡張

**ファイル**: `apps/api/src/services/execution.service.ts`

**追加メソッド**:
```typescript
async findByIdWithDetails(executionId: string) {
  // スナップショット、全結果データを含む詳細取得
  // preconditionResults, stepResults, expectedResults (with evidences)
}
```

**参考**: ExecutionRepository.findById()のinclude設定を拡張

---

### 3. バックエンド: ルート権限適用

**ファイル**: `apps/api/src/routes/executions.ts`

既存のルートに権限ミドルウェアを適用:
- GET /:executionId → READ以上
- POST /:executionId/abort → WRITE以上
- POST /:executionId/complete → WRITE以上
- PATCH /:executionId/* → WRITE以上
- POST /:executionId/*/evidences → WRITE以上

---

### 4. フロントエンド: StartExecutionModal作成

**ファイル**: `apps/web/src/components/execution/StartExecutionModal.tsx` (新規作成)

**UI構成**:
```
┌─────────────────────────────────────────┐
│ テスト実行を開始                          │
├─────────────────────────────────────────┤
│ テストスイート: {suiteName}               │
│                                         │
│ 環境を選択                               │
│ ┌─────────────────────────────────────┐ │
│ │ ○ Production (デフォルト)            │ │
│ │ ○ Staging                           │ │
│ │ ○ Development                       │ │
│ │ ○ 環境を選択しない                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ テストケース: 5件                         │
│ 前提条件: 3件                            │
│                                         │
│            [キャンセル] [実行開始]         │
└─────────────────────────────────────────┘
```

**Props**:
```typescript
interface StartExecutionModalProps {
  isOpen: boolean;
  testSuiteId: string;
  projectId: string;
  suiteName: string;
  testCaseCount: number;
  preconditionCount: number;
  onClose: () => void;
  onStarted: (execution: Execution) => void;
}
```

**実装内容**:
- `useQuery`でプロジェクト環境一覧を取得 (`projectsApi.getEnvironments`)
- デフォルト環境があれば初期選択
- 「環境を選択しない」オプションも提供
- `useMutation`で`testSuitesApi.startExecution`を呼び出し
- 成功時は実行ページへ遷移

**参考**: `apps/web/src/components/project/EnvironmentFormModal.tsx`

---

### 5. フロントエンド: 環境有無による分岐ロジック

**ファイル**: `apps/web/src/pages/TestSuiteDetail.tsx`

**仕様**:
- 環境が0件の場合 → モーダルをスキップして直接実行開始
- 環境が1件以上の場合 → StartExecutionModalを表示

```typescript
// 環境一覧を事前取得
const { data: environmentsData } = useQuery({
  queryKey: ['project-environments', suite?.projectId],
  queryFn: () => projectsApi.getEnvironments(suite!.projectId),
  enabled: !!suite?.projectId,
});

const environments = environmentsData?.environments || [];

// 実行開始ボタンのクリックハンドラ
const handleStartExecution = () => {
  if (environments.length === 0) {
    // 環境なし: 直接実行開始
    startExecutionMutation.mutate({});
  } else {
    // 環境あり: モーダル表示
    setIsStartExecutionModalOpen(true);
  }
};
```

**TestSuiteDetail.tsx追加変更**:
1. `isStartExecutionModalOpen`ステート追加
2. 「実行開始」ボタンでhandleStartExecutionを呼び出す
3. `StartExecutionModal`コンポーネントを追加
4. 実行開始成功時に`/executions/${id}`へ遷移

```tsx
<button
  onClick={handleStartExecution}
  disabled={startExecutionMutation.isPending || testCases.length === 0}
>
  実行開始
</button>

{isStartExecutionModalOpen && (
  <StartExecutionModal
    isOpen={isStartExecutionModalOpen}
    testSuiteId={testSuiteId}
    projectId={suite.projectId}
    suiteName={suite.name}
    testCaseCount={testCases.length}
    preconditionCount={suite._count?.preconditions || 0}
    onClose={() => setIsStartExecutionModalOpen(false)}
    onStarted={(execution) => {
      navigate(`/executions/${execution.id}`);
    }}
  />
)}
```

---

### 6. フロントエンド: API型定義追加

**ファイル**: `apps/web/src/lib/api.ts`

**追加型**:
```typescript
// スナップショットデータ型
export interface ExecutionSnapshot {
  testSuite: {
    id: string;
    name: string;
    description: string | null;
  };
  preconditions: Array<{
    id: string;
    content: string;
    orderKey: string;
  }>;
  testCases: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: string;
    preconditions: TestCasePrecondition[];
    steps: TestCaseStep[];
    expectedResults: TestCaseExpectedResult[];
  }>;
}

// 前提条件結果
export interface ExecutionPreconditionResult {
  id: string;
  executionId: string;
  snapshotPreconditionId: string;
  snapshotTestCaseId: string | null;
  status: 'UNCHECKED' | 'MET' | 'NOT_MET';
  checkedAt: string | null;
  note: string | null;
}

// ステップ結果
export interface ExecutionStepResult {
  id: string;
  executionId: string;
  snapshotTestCaseId: string;
  snapshotStepId: string;
  status: 'PENDING' | 'DONE' | 'SKIPPED';
  executedAt: string | null;
  note: string | null;
}

// 期待結果
export interface ExecutionExpectedResult {
  id: string;
  executionId: string;
  snapshotTestCaseId: string;
  snapshotExpectedResultId: string;
  status: 'PENDING' | 'PASS' | 'FAIL' | 'SKIPPED' | 'NOT_EXECUTABLE';
  judgedAt: string | null;
  note: string | null;
  evidences: ExecutionEvidence[];
}

// エビデンス
export interface ExecutionEvidence {
  id: string;
  expectedResultId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: string; // BigIntはstringとして受け取る
  description: string | null;
  createdAt: string;
}

// 詳細付き実行
export interface ExecutionWithDetails extends Execution {
  testSuite: { id: string; name: string; projectId: string };
  snapshot: { snapshotData: ExecutionSnapshot };
  preconditionResults: ExecutionPreconditionResult[];
  stepResults: ExecutionStepResult[];
  expectedResults: ExecutionExpectedResult[];
}
```

**executionsApi拡張**:
```typescript
export const executionsApi = {
  getById: (executionId: string) =>
    api.get<{ execution: Execution }>(`/api/executions/${executionId}`),
  getByIdWithDetails: (executionId: string) =>
    api.get<{ execution: ExecutionWithDetails }>(`/api/executions/${executionId}/details`),
  // ... 既存のメソッド
};
```

---

## ファイル変更一覧

| ファイル | 操作 | 内容 |
|---------|-----|------|
| `apps/api/src/middleware/require-execution-role.ts` | 新規 | 権限ミドルウェア |
| `apps/api/src/services/execution.service.ts` | 修正 | findByIdWithDetails追加 |
| `apps/api/src/routes/executions.ts` | 修正 | 権限ミドルウェア適用 |
| `apps/web/src/components/execution/StartExecutionModal.tsx` | 新規 | 環境選択モーダル |
| `apps/web/src/pages/TestSuiteDetail.tsx` | 修正 | モーダル統合 |
| `apps/web/src/lib/api.ts` | 修正 | 型定義追加 |

---

## 権限要件

| 操作 | 必要ロール |
|------|-----------|
| 実行詳細閲覧 | READ以上 |
| 実行開始 | WRITE以上 |
| 実行中止/完了 | WRITE以上 |
| 結果更新 | WRITE以上 |

---

## 実装順序

1. `require-execution-role.ts` (権限ミドルウェア)
2. `execution.service.ts` (findByIdWithDetails)
3. `executions.ts` (ルート権限適用)
4. `api.ts` (型定義追加)
5. `StartExecutionModal.tsx` (モーダル作成)
6. `TestSuiteDetail.tsx` (統合)
