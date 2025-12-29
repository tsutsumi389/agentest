# Step 1: バックエンドAPI拡充（前提条件/ステップ/期待結果の完全CRUD）

## 概要

テストケースの前提条件(Precondition)、ステップ(Step)、期待結果(ExpectedResult)に対して、
Update(更新)、Delete(削除)、Reorder(並び替え)のAPIを追加する。

## 現状の実装状況

| エンティティ | Create | Read | Update | Delete | Reorder |
|-------------|--------|------|--------|--------|---------|
| 前提条件 | ✅ | ✅ | ❌ | ❌ | ❌ |
| ステップ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 期待結果 | ✅ | ✅ | ❌ | ❌ | ❌ |

## 追加するエンドポイント

### 前提条件（Preconditions）
```
PATCH  /api/test-cases/:testCaseId/preconditions/:preconditionId
DELETE /api/test-cases/:testCaseId/preconditions/:preconditionId
POST   /api/test-cases/:testCaseId/preconditions/reorder
```

### ステップ（Steps）
```
PATCH  /api/test-cases/:testCaseId/steps/:stepId
DELETE /api/test-cases/:testCaseId/steps/:stepId
POST   /api/test-cases/:testCaseId/steps/reorder
```

### 期待結果（Expected Results）
```
PATCH  /api/test-cases/:testCaseId/expected-results/:expectedResultId
DELETE /api/test-cases/:testCaseId/expected-results/:expectedResultId
POST   /api/test-cases/:testCaseId/expected-results/reorder
```

---

## 実装タスク

### Task 1: サービス層 - 前提条件のCRUD拡充

**ファイル**: `apps/api/src/services/test-case.service.ts`

**参照実装**: `apps/api/src/services/test-suite.service.ts`（行254-431）

追加メソッド:
1. `updatePrecondition(testCaseId, preconditionId, userId, data: { content: string })`
   - テストケース/前提条件の存在確認
   - 履歴保存（TestCaseHistory）
   - 前提条件の更新

2. `deletePrecondition(testCaseId, preconditionId, userId)`
   - テストケース/前提条件の存在確認
   - トランザクション内で:
     - 履歴保存
     - 前提条件の削除
     - 残りの前提条件のorderKey再整列

3. `reorderPreconditions(testCaseId, preconditionIds: string[], userId)`
   - 全件指定チェック
   - 重複IDチェック
   - 履歴保存
   - トランザクションでorderKey一括更新

### Task 2: サービス層 - ステップのCRUD拡充

**ファイル**: `apps/api/src/services/test-case.service.ts`

追加メソッド:
1. `updateStep(testCaseId, stepId, userId, data: { content: string })`
2. `deleteStep(testCaseId, stepId, userId)`
3. `reorderSteps(testCaseId, stepIds: string[], userId)`

### Task 3: サービス層 - 期待結果のCRUD拡充

**ファイル**: `apps/api/src/services/test-case.service.ts`

追加メソッド:
1. `updateExpectedResult(testCaseId, expectedResultId, userId, data: { content: string })`
2. `deleteExpectedResult(testCaseId, expectedResultId, userId)`
3. `reorderExpectedResults(testCaseId, expectedResultIds: string[], userId)`

### Task 4: コントローラー層 - 新規メソッド追加

**ファイル**: `apps/api/src/controllers/test-case.controller.ts`

追加スキーマ:
```typescript
const updateContentSchema = z.object({
  content: z.string().min(1).max(2000),
});

const reorderIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(0),
});
```

追加メソッド（計9個）:
- `updatePrecondition`, `deletePrecondition`, `reorderPreconditions`
- `updateStep`, `deleteStep`, `reorderSteps`
- `updateExpectedResult`, `deleteExpectedResult`, `reorderExpectedResults`

### Task 5: ルート定義 - エンドポイント追加

**ファイル**: `apps/api/src/routes/test-cases.ts`

追加ルート（計9個）:
```typescript
// 前提条件
router.patch('/:testCaseId/preconditions/:preconditionId', requireAuth(authConfig), controller.updatePrecondition);
router.delete('/:testCaseId/preconditions/:preconditionId', requireAuth(authConfig), controller.deletePrecondition);
router.post('/:testCaseId/preconditions/reorder', requireAuth(authConfig), controller.reorderPreconditions);

// ステップ
router.patch('/:testCaseId/steps/:stepId', requireAuth(authConfig), controller.updateStep);
router.delete('/:testCaseId/steps/:stepId', requireAuth(authConfig), controller.deleteStep);
router.post('/:testCaseId/steps/reorder', requireAuth(authConfig), controller.reorderSteps);

// 期待結果
router.patch('/:testCaseId/expected-results/:expectedResultId', requireAuth(authConfig), controller.updateExpectedResult);
router.delete('/:testCaseId/expected-results/:expectedResultId', requireAuth(authConfig), controller.deleteExpectedResult);
router.post('/:testCaseId/expected-results/reorder', requireAuth(authConfig), controller.reorderExpectedResults);
```

### Task 6: 既存のaddメソッドに履歴保存を追加

**ファイル**: `apps/api/src/services/test-case.service.ts`

現在のaddPrecondition/addStep/addExpectedResultは履歴保存なしで実装されている。
テストスイートのパターンに合わせて履歴保存を追加する。

変更対象:
- `addPrecondition()` - userId引数追加、履歴保存追加
- `addStep()` - userId引数追加、履歴保存追加
- `addExpectedResult()` - userId引数追加、履歴保存追加

### Task 7: 履歴スナップショット型の定義

**ファイル**: `apps/api/src/services/test-case.service.ts`

テストスイートサービスを参考に、以下の型を定義:
```typescript
type TestCaseSnapshot = {
  id: string;
  testSuiteId: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
};

type ChildEntityChangeDetail =
  | { type: 'PRECONDITION_ADD'; preconditionId: string; added: { content: string; orderKey: string } }
  | { type: 'PRECONDITION_UPDATE'; preconditionId: string; before: { content: string }; after: { content: string } }
  | { type: 'PRECONDITION_DELETE'; preconditionId: string; deleted: { content: string; orderKey: string } }
  | { type: 'PRECONDITION_REORDER'; before: string[]; after: string[] }
  | { type: 'STEP_ADD'; stepId: string; added: { content: string; orderKey: string } }
  | { type: 'STEP_UPDATE'; stepId: string; before: { content: string }; after: { content: string } }
  | { type: 'STEP_DELETE'; stepId: string; deleted: { content: string; orderKey: string } }
  | { type: 'STEP_REORDER'; before: string[]; after: string[] }
  | { type: 'EXPECTED_RESULT_ADD'; expectedResultId: string; added: { content: string; orderKey: string } }
  | { type: 'EXPECTED_RESULT_UPDATE'; expectedResultId: string; before: { content: string }; after: { content: string } }
  | { type: 'EXPECTED_RESULT_DELETE'; expectedResultId: string; deleted: { content: string; orderKey: string } }
  | { type: 'EXPECTED_RESULT_REORDER'; before: string[]; after: string[] };
```

---

## 修正ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `apps/api/src/services/test-case.service.ts` | 9メソッド追加、3メソッド修正、型定義追加 |
| `apps/api/src/controllers/test-case.controller.ts` | 9メソッド追加、Zodスキーマ追加 |
| `apps/api/src/routes/test-cases.ts` | 9ルート追加 |

---

## API仕様詳細

### PATCH /api/test-cases/:testCaseId/preconditions/:preconditionId
```
Request: { content: string }
Response: { precondition: TestCasePrecondition }
```

### DELETE /api/test-cases/:testCaseId/preconditions/:preconditionId
```
Response: 204 No Content
```

### POST /api/test-cases/:testCaseId/preconditions/reorder
```
Request: { ids: string[] }
Response: { preconditions: TestCasePrecondition[] }
```

（ステップ、期待結果も同様のパターン）

---

## 実装順序

1. Task 7: 履歴スナップショット型の定義
2. Task 1: 前提条件のCRUD拡充（サービス層）
3. Task 2: ステップのCRUD拡充（サービス層）
4. Task 3: 期待結果のCRUD拡充（サービス層）
5. Task 6: 既存addメソッドの履歴保存追加
6. Task 4: コントローラー層の新規メソッド追加
7. Task 5: ルート定義追加

---

## テスト観点

- 存在しないテストケースIDでのエラーハンドリング
- 存在しない子エンティティIDでのエラーハンドリング
- reorder時の全件指定チェック
- reorder時の重複IDチェック
- 削除後のorderKey再整列
- 履歴が正しく保存されること
