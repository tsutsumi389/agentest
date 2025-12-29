# Step 2: テストケース並替API 実装計画

## 概要

テストスイート内のテストケースの並び順を変更するAPIを実装する。

## エンドポイント

```
POST /api/test-suites/:testSuiteId/test-cases/reorder
Request: { testCaseIds: string[] }
Response: { testCases: TestCase[] }
```

## 前提条件

- TestCase モデルには既に `orderKey` フィールドが存在
- インデックス `@@index([testSuiteId, orderKey])` 設定済み
- 既存の並び替えAPI（前提条件/ステップ/期待結果）のパターンを踏襲

---

## 実装タスク

### 1. Zodスキーマ追加

**ファイル:** `packages/shared/src/validators/schemas.ts`

```typescript
// テストケース並び替えスキーマ
export const testCaseReorderSchema = z.object({
  testCaseIds: z.array(z.string().uuid()).min(1),
});
```

### 2. サービス層実装

**ファイル:** `apps/api/src/services/test-suite.service.ts`

**メソッド追加:** `reorderTestCases(testSuiteId: string, testCaseIds: string[], userId: string)`

**処理フロー:**
1. テストスイートの存在確認
2. 指定されたテストスイートに属するテストケース一覧を取得（削除済み除外）
3. バリデーション:
   - 空配列チェック（0件の場合はそのまま返す）
   - 重複IDチェック
   - 全件指定確認（指定IDと既存IDが完全一致）
   - 同値チェック（順序が変わっていない場合はそのまま返す）
4. 履歴スナップショット作成（changeDetail.type = `TEST_CASE_REORDER`）
5. トランザクション内で:
   - 履歴保存（TestSuiteHistory）
   - orderKey更新（並列実行）
6. 更新後のテストケース一覧を返却

**参考実装:** 同ファイル内の `reorderPreconditions` メソッド（行360-431）

### 3. コントローラー層実装

**ファイル:** `apps/api/src/controllers/test-suite.controller.ts`

```typescript
reorderTestCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { testSuiteId } = req.params;
  const { testCaseIds } = testCaseReorderSchema.parse(req.body);
  const testCases = await this.testSuiteService.reorderTestCases(
    testSuiteId, testCaseIds, req.user!.id
  );
  res.json({ testCases });
};
```

### 4. ルート定義追加

**ファイル:** `apps/api/src/routes/test-suites.ts`

```typescript
// テストケース並び替え
router.post(
  '/:testSuiteId/test-cases/reorder',
  requireAuth(authConfig),
  requireTestSuiteRole(['ADMIN', 'WRITE']),
  testSuiteController.reorderTestCases
);
```

**挿入位置:** 既存の `/test-cases` 関連ルートの近く（行75付近）

### 5. 履歴スナップショット型の更新

**ファイル:** `apps/api/src/services/test-suite.service.ts`

`HistorySnapshot` の `changeDetail.type` に `TEST_CASE_REORDER` を追加可能にする。

---

## ファイル変更一覧

| ファイル | 変更内容 |
|----------|----------|
| `packages/shared/src/validators/schemas.ts` | `testCaseReorderSchema` 追加 |
| `apps/api/src/services/test-suite.service.ts` | `reorderTestCases` メソッド追加 |
| `apps/api/src/controllers/test-suite.controller.ts` | `reorderTestCases` メソッド追加、スキーマインポート |
| `apps/api/src/routes/test-suites.ts` | POST `/test-cases/reorder` ルート追加 |

---

## 詳細実装コード

### サービス層（test-suite.service.ts）

```typescript
async reorderTestCases(
  testSuiteId: string,
  testCaseIds: string[],
  userId: string
): Promise<TestCase[]> {
  // テストスイート取得
  const testSuite = await this.findById(testSuiteId);

  // 現在のテストケース一覧取得
  const testCases = await prisma.testCase.findMany({
    where: {
      testSuiteId,
      deletedAt: null,
    },
    orderBy: { orderKey: 'asc' },
  });

  // 空配列チェック
  if (testCaseIds.length === 0) {
    return testCases;
  }

  // 重複チェック
  const uniqueIds = new Set(testCaseIds);
  if (uniqueIds.size !== testCaseIds.length) {
    throw new AppError('VALIDATION_ERROR', '重複したテストケースIDが含まれています');
  }

  // 全件指定確認
  const existingIds = testCases.map((tc) => tc.id);
  const existingIdSet = new Set(existingIds);
  const missingIds = testCaseIds.filter((id) => !existingIdSet.has(id));
  if (missingIds.length > 0) {
    throw new AppError('VALIDATION_ERROR', '存在しないテストケースIDが含まれています');
  }

  const extraIds = existingIds.filter((id) => !uniqueIds.has(id));
  if (extraIds.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'すべてのテストケースを指定してください');
  }

  // 同値チェック
  const isSameOrder = testCaseIds.every((id, index) => id === existingIds[index]);
  if (isSameOrder) {
    return testCases;
  }

  // 履歴スナップショット作成
  const snapshot: HistorySnapshot = {
    id: testSuite.id,
    projectId: testSuite.projectId,
    name: testSuite.name,
    description: testSuite.description,
    status: testSuite.status,
    testCases: testCases.map((tc) => ({
      id: tc.id,
      title: tc.title,
      orderKey: tc.orderKey,
    })),
    changeDetail: {
      type: 'TEST_CASE_REORDER',
      before: existingIds,
      after: testCaseIds,
    },
  };

  // トランザクション実行
  await prisma.$transaction(async (tx) => {
    // 履歴保存
    await tx.testSuiteHistory.create({
      data: {
        testSuiteId,
        changedByUserId: userId,
        snapshot: snapshot as unknown as Prisma.JsonObject,
      },
    });

    // orderKey更新（並列実行）
    await Promise.all(
      testCaseIds.map((id, index) =>
        tx.testCase.update({
          where: { id },
          data: { orderKey: indexToOrderKey(index) },
        })
      )
    );
  });

  // 更新後のテストケース一覧を返却
  return prisma.testCase.findMany({
    where: {
      testSuiteId,
      deletedAt: null,
    },
    orderBy: { orderKey: 'asc' },
  });
}
```

---

## 権限要件

- OWNER: 可
- ADMIN: 可
- WRITE: 可
- READ: 不可

既存の `requireTestSuiteRole(['ADMIN', 'WRITE'])` ミドルウェアを使用。

---

## テスト観点

1. 正常系: テストケースの順序が正しく更新される
2. 空配列: そのまま現在のリストを返却
3. 重複ID: エラー返却
4. 存在しないID: エラー返却
5. 部分指定（一部のみ）: エラー返却
6. 同一順序: 履歴を作成せずそのまま返却
7. 権限チェック: READ権限では403エラー
