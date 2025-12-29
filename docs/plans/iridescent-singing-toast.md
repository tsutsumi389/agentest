# テストケースコピーAPI（TC-003）実装計画

## 概要

テストケースを同一プロジェクト内でコピーするAPIを実装する。同一テストスイート内、または別のテストスイートへのコピーをサポート。

## API仕様

```
POST /api/test-cases/:testCaseId/copy
Request:  { targetTestSuiteId?: string, title?: string }
Response: { testCase: TestCaseWithDetails }
Status:   201 Created
```

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/routes/test-cases.ts` | コピーエンドポイント追加 |
| `apps/api/src/controllers/test-case.controller.ts` | copyメソッド追加 |
| `apps/api/src/services/test-case.service.ts` | copyメソッド追加 |
| `apps/api/src/__tests__/unit/test-case.service.copy.test.ts` | ユニットテスト新規作成 |
| `apps/api/src/__tests__/integration/test-case-copy.integration.test.ts` | 統合テスト新規作成 |

## 実装詳細

### 1. ルート定義（test-cases.ts）

```typescript
// 122行目付近に追加
/**
 * テストケースコピー
 * POST /api/test-cases/:testCaseId/copy
 */
router.post('/:testCaseId/copy', requireAuth(authConfig), testCaseController.copy);
```

### 2. コントローラー（test-case.controller.ts）

```typescript
// Zodスキーマ追加
const copyTestCaseSchema = z.object({
  targetTestSuiteId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
});

// copyメソッド追加
copy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { testCaseId } = req.params;
    const data = copyTestCaseSchema.parse(req.body);
    const testCase = await this.testCaseService.copy(testCaseId, req.user!.id, data);
    res.status(201).json({ testCase });
  } catch (error) {
    next(error);
  }
};
```

### 3. サービス（test-case.service.ts）

#### 3.1 コピー履歴用の型定義追加

```typescript
type CopyChangeDetail = {
  type: 'COPY';
  sourceTestCaseId: string;
  sourceTitle: string;
  targetTestSuiteId: string;
};

// ChildEntityChangeDetail に追加
| CopyChangeDetail;
```

#### 3.2 copyメソッド実装

処理フロー：
1. コピー元テストケース取得（子エンティティ含む）
2. 削除済みチェック
3. コピー先テストスイート決定・検証
4. 同一プロジェクト内チェック
5. トランザクションでコピー実行：
   - テストケース作成（status: DRAFT）
   - 前提条件コピー（createMany）
   - ステップコピー（createMany）
   - 期待結果コピー（createMany）
   - 履歴記録（changeType: CREATE, copyDetail付き）
6. 詳細情報を含めて返却

```typescript
async copy(
  testCaseId: string,
  userId: string,
  data: { targetTestSuiteId?: string; title?: string }
) {
  // 1. コピー元取得
  const sourceTestCase = await prisma.testCase.findFirst({
    where: { id: testCaseId },
    include: {
      testSuite: { select: { id: true, projectId: true } },
      preconditions: { orderBy: { orderKey: 'asc' } },
      steps: { orderBy: { orderKey: 'asc' } },
      expectedResults: { orderBy: { orderKey: 'asc' } },
    },
  });
  if (!sourceTestCase) {
    throw new NotFoundError('TestCase', testCaseId);
  }
  if (sourceTestCase.deletedAt) {
    throw new BadRequestError('削除済みテストケースはコピーできません');
  }

  // 2. コピー先テストスイート検証
  const targetTestSuiteId = data.targetTestSuiteId ?? sourceTestCase.testSuiteId;
  const targetTestSuite = await prisma.testSuite.findFirst({
    where: { id: targetTestSuiteId, deletedAt: null },
    include: { project: { select: { id: true } } },
  });
  if (!targetTestSuite) {
    throw new NotFoundError('TestSuite', targetTestSuiteId);
  }

  // 3. 同一プロジェクト内チェック
  if (sourceTestCase.testSuite.projectId !== targetTestSuite.project.id) {
    throw new BadRequestError('異なるプロジェクトへのコピーはできません');
  }

  // 4. タイトル生成
  const newTitle = data.title ?? `${sourceTestCase.title} (コピー)`;

  // 5. トランザクションでコピー
  return prisma.$transaction(async (tx) => {
    // orderKey取得
    const lastTestCase = await tx.testCase.findFirst({
      where: { testSuiteId: targetTestSuiteId },
      orderBy: { orderKey: 'desc' },
    });
    const orderKey = getNextOrderKey(lastTestCase?.orderKey ?? null);

    // テストケース作成
    const newTestCase = await tx.testCase.create({
      data: {
        testSuiteId: targetTestSuiteId,
        title: newTitle,
        description: sourceTestCase.description,
        priority: sourceTestCase.priority,
        status: 'DRAFT',
        orderKey,
        createdByUserId: userId,
      },
    });

    // 子エンティティをコピー
    if (sourceTestCase.preconditions.length > 0) {
      await tx.testCasePrecondition.createMany({
        data: sourceTestCase.preconditions.map((p) => ({
          testCaseId: newTestCase.id,
          content: p.content,
          orderKey: p.orderKey,
        })),
      });
    }

    if (sourceTestCase.steps.length > 0) {
      await tx.testCaseStep.createMany({
        data: sourceTestCase.steps.map((s) => ({
          testCaseId: newTestCase.id,
          content: s.content,
          orderKey: s.orderKey,
        })),
      });
    }

    if (sourceTestCase.expectedResults.length > 0) {
      await tx.testCaseExpectedResult.createMany({
        data: sourceTestCase.expectedResults.map((e) => ({
          testCaseId: newTestCase.id,
          content: e.content,
          orderKey: e.orderKey,
        })),
      });
    }

    // 履歴記録
    const snapshot: HistorySnapshot = {
      id: newTestCase.id,
      testSuiteId: newTestCase.testSuiteId,
      title: newTestCase.title,
      description: newTestCase.description,
      priority: newTestCase.priority,
      status: newTestCase.status,
      preconditions: sourceTestCase.preconditions.map((p) => ({
        id: p.id, content: p.content, orderKey: p.orderKey,
      })),
      steps: sourceTestCase.steps.map((s) => ({
        id: s.id, content: s.content, orderKey: s.orderKey,
      })),
      expectedResults: sourceTestCase.expectedResults.map((e) => ({
        id: e.id, content: e.content, orderKey: e.orderKey,
      })),
      changeDetail: {
        type: 'COPY',
        sourceTestCaseId: testCaseId,
        sourceTitle: sourceTestCase.title,
        targetTestSuiteId,
      },
    };

    await tx.testCaseHistory.create({
      data: {
        testCaseId: newTestCase.id,
        changedByUserId: userId,
        changeType: 'CREATE',
        snapshot: toJsonSnapshot(snapshot),
      },
    });

    // 詳細情報を含めて返却
    return tx.testCase.findUnique({
      where: { id: newTestCase.id },
      include: {
        testSuite: { select: { id: true, name: true, projectId: true } },
        createdByUser: { select: { id: true, name: true, avatarUrl: true } },
        preconditions: { orderBy: { orderKey: 'asc' } },
        steps: { orderBy: { orderKey: 'asc' } },
        expectedResults: { orderBy: { orderKey: 'asc' } },
      },
    });
  });
}
```

## エラーハンドリング

| エラー条件 | エラークラス | HTTP | メッセージ |
|-----------|------------|------|----------|
| コピー元が見つからない | NotFoundError | 404 | TestCase with id 'xxx' not found |
| 削除済みテストケース | BadRequestError | 400 | 削除済みテストケースはコピーできません |
| コピー先テストスイートが見つからない | NotFoundError | 404 | TestSuite with id 'xxx' not found |
| 別プロジェクトへのコピー | BadRequestError | 400 | 異なるプロジェクトへのコピーはできません |
| タイトル文字数超過 | ZodError | 400 | Zodバリデーションエラー |
| 未認証 | AuthenticationError | 401 | Authentication required |

## テスト計画

### ユニットテスト（test-case.service.copy.test.ts）

**正常系：**
- 同一テストスイート内にコピーできる
- 別のテストスイートにコピーできる
- 前提条件がコピーされる
- ステップがコピーされる
- 期待結果がコピーされる
- カスタムタイトルを指定できる
- タイトル未指定時は「(コピー)」が付与される
- コピー後のステータスはDRAFTになる
- orderKeyが正しく生成される
- 履歴が記録される

**異常系：**
- 存在しないテストケースの場合NotFoundError
- 削除済みテストケースの場合BadRequestError
- 存在しないコピー先テストスイートの場合NotFoundError
- 別プロジェクトへのコピーはBadRequestError

**エッジケース：**
- 前提条件がないテストケースをコピーできる
- ステップがないテストケースをコピーできる
- 期待結果がないテストケースをコピーできる
- 子エンティティが全てないテストケースをコピーできる

### 統合テスト（test-case-copy.integration.test.ts）

**正常系：**
- POST /api/test-cases/:testCaseId/copy で201が返る
- 前提条件・ステップ・期待結果が完全にコピーされる
- レスポンスに完全なテストケース詳細が含まれる

**異常系：**
- 存在しないテストケースは404
- 削除済みテストケースからのコピーは400
- 別プロジェクトへのコピーは400
- 無効なUUID形式は400

**認証・認可：**
- 未認証は401
- 認証済みユーザーはコピー可能

## 実装順序

1. サービス層にcopyメソッド追加
2. コントローラーにcopyメソッド追加
3. ルート定義追加
4. ユニットテスト作成
5. 統合テスト作成
6. 全テスト実行・検証

## 備考

- 認可チェックは既存の`requireAuth`のみを使用（テストケース作成と同等の権限で十分）
- コピー先テストスイートへの権限は、同一プロジェクト内チェックで暗黙的に保証
- コピー後のステータスは常に`DRAFT`に設定（元のステータスは引き継がない）
