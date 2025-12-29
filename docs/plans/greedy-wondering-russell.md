# Step 3: テストケース検索・フィルタ・ソートAPI 実装計画

## 概要

テストスイート内のテストケースを検索・フィルタ・ソートするAPIを実装する。

## エンドポイント

```
GET /api/test-suites/:testSuiteId/test-cases
```

### クエリパラメータ

| パラメータ | 型 | 説明 | デフォルト |
|------------|------|------|------------|
| `q` | string | タイトル、手順内容、期待結果内容でLIKE検索 | - |
| `status` | string | DRAFT,ACTIVE,ARCHIVED（カンマ区切りで複数可） | - |
| `priority` | string | CRITICAL,HIGH,MEDIUM,LOW（カンマ区切りで複数可） | - |
| `limit` | number | 取得件数 (1-100) | 20 |
| `offset` | number | スキップ件数 | 0 |
| `sortBy` | string | title, createdAt, updatedAt, priority, orderKey | orderKey |
| `sortOrder` | string | asc, desc | asc |
| `includeDeleted` | boolean | 削除済みを含めるか | false |

---

## 変更ファイル

### 1. packages/shared/src/validators/schemas.ts
- `testCaseSearchSchema` を追加
- 複数選択フィルタはカンマ区切り文字列を配列に変換

### 2. apps/api/src/repositories/test-case.repository.ts
- `TestCaseSearchOptions` インターフェースを追加
- `search()` メソッドを追加

### 3. apps/api/src/services/test-suite.service.ts
- `searchTestCases()` メソッドを追加

### 4. apps/api/src/controllers/test-suite.controller.ts
- `getTestCases()` を検索対応に変更

---

## 実装詳細

### Step 1: Zodスキーマ追加

**packages/shared/src/validators/schemas.ts**

```typescript
// テストケース検索スキーマ
export const testCaseSearchSchema = z.object({
  q: z.string().max(100).optional(),
  // 複数選択対応: カンマ区切り → 配列変換
  status: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(entityStatusSchema).optional()),
  priority: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(testCasePrioritySchema).optional()),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'priority', 'orderKey']).default('orderKey'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeDeleted: z.coerce.boolean().default(false),
});

export type TestCaseSearch = z.infer<typeof testCaseSearchSchema>;
```

### Step 2: リポジトリ層

**apps/api/src/repositories/test-case.repository.ts**

```typescript
export interface TestCaseSearchOptions {
  q?: string;
  status?: EntityStatus[];
  priority?: TestCasePriority[];
  limit: number;
  offset: number;
  sortBy: 'title' | 'createdAt' | 'updatedAt' | 'priority' | 'orderKey';
  sortOrder: 'asc' | 'desc';
  includeDeleted: boolean;
}

async search(testSuiteId: string, options: TestCaseSearchOptions) {
  const where: Prisma.TestCaseWhereInput = {
    testSuiteId,
    deletedAt: options.includeDeleted ? undefined : null,
  };

  // 複数選択フィルタ
  if (options.status?.length) {
    where.status = { in: options.status };
  }
  if (options.priority?.length) {
    where.priority = { in: options.priority };
  }

  // キーワード検索（タイトル、手順、期待結果）
  if (options.q) {
    where.OR = [
      { title: { contains: options.q, mode: 'insensitive' } },
      { steps: { some: { content: { contains: options.q, mode: 'insensitive' } } } },
      { expectedResults: { some: { content: { contains: options.q, mode: 'insensitive' } } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.testCase.findMany({
      where,
      include: {
        createdByUser: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { preconditions: true, steps: true, expectedResults: true } },
      },
      orderBy: { [options.sortBy]: options.sortOrder },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.testCase.count({ where }),
  ]);

  return { items, total };
}
```

### Step 3: サービス層

**apps/api/src/services/test-suite.service.ts**

```typescript
async searchTestCases(testSuiteId: string, options: TestCaseSearchOptions) {
  // テストスイート存在確認
  await this.findById(testSuiteId);
  return this.testCaseRepo.search(testSuiteId, options);
}
```

### Step 4: コントローラー層

**apps/api/src/controllers/test-suite.controller.ts**

```typescript
import { testCaseSearchSchema } from '@agentest/shared';

getTestCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { testSuiteId } = req.params;
    const searchParams = testCaseSearchSchema.parse(req.query);
    const { items, total } = await this.testSuiteService.searchTestCases(testSuiteId, searchParams);

    res.json({
      testCases: items,
      total,
      limit: searchParams.limit,
      offset: searchParams.offset,
    });
  } catch (error) {
    next(error);
  }
};
```

---

## レスポンス形式

```json
{
  "testCases": [
    {
      "id": "uuid",
      "title": "テストケース名",
      "priority": "HIGH",
      "status": "ACTIVE",
      "orderKey": "00001",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "createdByUser": { "id": "...", "name": "...", "avatarUrl": null },
      "_count": { "preconditions": 2, "steps": 5, "expectedResults": 3 }
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

---

## テスト計画

### ユニットテスト
- キーワード検索（タイトル/手順/期待結果）
- 複数選択フィルタ（status, priority）
- ページネーション（limit, offset）
- ソート（各フィールド、昇順/降順）
- 削除済み含む/除外

### 統合テスト
- 認証・認可チェック
- バリデーションエラー
- 検索結果0件

---

## 実装順序

1. `packages/shared/src/validators/schemas.ts` - testCaseSearchSchema追加
2. `apps/api/src/repositories/test-case.repository.ts` - search()メソッド追加
3. `apps/api/src/services/test-suite.service.ts` - searchTestCases()追加
4. `apps/api/src/controllers/test-suite.controller.ts` - getTestCases()拡張
5. ユニットテスト作成
6. 統合テスト作成
