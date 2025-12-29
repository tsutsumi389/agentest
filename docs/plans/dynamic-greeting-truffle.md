# TC-004: @参照入力用検索API 実装計画

## 概要

テストケース作成時の`@`メンション機能のためのサジェスションAPIを実装する。

## エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/projects/:projectId/suggestions/test-suites` | プロジェクト内のテストスイートをサジェスト |
| GET | `/api/test-suites/:testSuiteId/suggestions/test-cases` | テストスイート内のテストケースをサジェスト |

### クエリパラメータ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| q | string | - | 検索キーワード（最大100文字） |
| limit | number | 10 | 取得件数（1-50） |

### レスポンス

```typescript
// テストスイートサジェスト
{ suggestions: Array<{ id, name, description, status }> }

// テストケースサジェスト
{ suggestions: Array<{ id, title, description, priority, status }> }
```

---

## 実装手順

### Step 1: Zodスキーマ追加

**ファイル:** `packages/shared/src/validators/schemas.ts`

```typescript
export const suggestionSearchSchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type SuggestionSearch = z.infer<typeof suggestionSearchSchema>;
```

---

### Step 2: リポジトリにsuggestメソッド追加

**ファイル:** `apps/api/src/repositories/test-suite.repository.ts`

```typescript
async suggest(projectId: string, options: { q?: string; limit: number }) {
  const where: Prisma.TestSuiteWhereInput = {
    projectId,
    deletedAt: null,
  };

  if (options.q) {
    where.OR = [
      { name: { contains: options.q, mode: 'insensitive' } },
      { description: { contains: options.q, mode: 'insensitive' } },
    ];
  }

  return prisma.testSuite.findMany({
    where,
    select: { id: true, name: true, description: true, status: true },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: options.limit,
  });
}
```

**ファイル:** `apps/api/src/repositories/test-case.repository.ts`

```typescript
async suggest(testSuiteId: string, options: { q?: string; limit: number }) {
  const where: Prisma.TestCaseWhereInput = {
    testSuiteId,
    deletedAt: null,
  };

  if (options.q) {
    where.OR = [
      { title: { contains: options.q, mode: 'insensitive' } },
      { description: { contains: options.q, mode: 'insensitive' } },
    ];
  }

  return prisma.testCase.findMany({
    where,
    select: { id: true, title: true, description: true, priority: true, status: true },
    orderBy: [{ status: 'asc' }, { orderKey: 'asc' }],
    take: options.limit,
  });
}
```

---

### Step 3: サービスにsuggestメソッド追加

**ファイル:** `apps/api/src/services/project.service.ts`

```typescript
async suggestTestSuites(projectId: string, options: SuggestionSearch) {
  const project = await this.projectRepo.findById(projectId);
  if (!project) {
    throw new NotFoundError('Project', projectId);
  }
  return this.testSuiteRepo.suggest(projectId, options);
}
```

**ファイル:** `apps/api/src/services/test-suite.service.ts`

```typescript
async suggestTestCases(testSuiteId: string, options: SuggestionSearch) {
  await this.findById(testSuiteId);
  return this.testCaseRepo.suggest(testSuiteId, options);
}
```

---

### Step 4: コントローラーにsuggestメソッド追加

**ファイル:** `apps/api/src/controllers/project.controller.ts`

```typescript
suggestTestSuites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const searchParams = suggestionSearchSchema.parse(req.query);
    const suggestions = await this.projectService.suggestTestSuites(projectId, searchParams);
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
};
```

**ファイル:** `apps/api/src/controllers/test-suite.controller.ts`

```typescript
suggestTestCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { testSuiteId } = req.params;
    const searchParams = suggestionSearchSchema.parse(req.query);
    const suggestions = await this.testSuiteService.suggestTestCases(testSuiteId, searchParams);
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
};
```

---

### Step 5: ルーティング追加

**ファイル:** `apps/api/src/routes/projects.ts`

```typescript
router.get(
  '/:projectId/suggestions/test-suites',
  requireAuth(authConfig),
  requireProjectRole(['ADMIN', 'WRITE', 'READ']),
  projectController.suggestTestSuites
);
```

**ファイル:** `apps/api/src/routes/test-suites.ts`

```typescript
router.get(
  '/:testSuiteId/suggestions/test-cases',
  requireAuth(authConfig),
  requireTestSuiteRole(['ADMIN', 'WRITE', 'READ']),
  testSuiteController.suggestTestCases
);
```

---

### Step 6: フロントエンドAPI関数追加

**ファイル:** `apps/web/src/lib/api.ts`

```typescript
// projectsApi に追加
suggestTestSuites: (projectId: string, params?: { q?: string; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  const queryString = query.toString();
  return api.get<{ suggestions: TestSuiteSuggestion[] }>(
    `/api/projects/${projectId}/suggestions/test-suites${queryString ? `?${queryString}` : ''}`
  );
},

// testSuitesApi に追加
suggestTestCases: (testSuiteId: string, params?: { q?: string; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  const queryString = query.toString();
  return api.get<{ suggestions: TestCaseSuggestion[] }>(
    `/api/test-suites/${testSuiteId}/suggestions/test-cases${queryString ? `?${queryString}` : ''}`
  );
},
```

---

### Step 7: 結合テスト追加

**ファイル:** `apps/api/src/__tests__/integration/suggestion-api.integration.test.ts`（新規）

テストケース:
- テストスイート/テストケースサジェストを取得できる
- クエリで絞り込みできる（大文字小文字区別なし）
- description でも検索できる
- limit で取得件数を制限できる
- 削除済みエンティティは含まれない
- READ ロールでもアクセスできる
- 未認証は401、権限なしは403、存在しないIDは404
- 不正なパラメータは400

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `packages/shared/src/validators/schemas.ts` | suggestionSearchSchema 追加 |
| `apps/api/src/repositories/test-suite.repository.ts` | suggest メソッド追加 |
| `apps/api/src/repositories/test-case.repository.ts` | suggest メソッド追加 |
| `apps/api/src/services/project.service.ts` | suggestTestSuites メソッド追加 |
| `apps/api/src/services/test-suite.service.ts` | suggestTestCases メソッド追加 |
| `apps/api/src/controllers/project.controller.ts` | suggestTestSuites メソッド追加 |
| `apps/api/src/controllers/test-suite.controller.ts` | suggestTestCases メソッド追加 |
| `apps/api/src/routes/projects.ts` | ルーティング追加 |
| `apps/api/src/routes/test-suites.ts` | ルーティング追加 |
| `apps/web/src/lib/api.ts` | API関数追加 |
| `apps/api/src/__tests__/integration/suggestion-api.integration.test.ts` | 新規テスト |

---

## 設計決定事項

| 項目 | 決定 | 理由 |
|------|------|------|
| レスポンス形式 | 最小限（id, name/title, description, status, priority） | ライトウェイトなサジェスト用途 |
| 検索対象 | name/title + description | 基本的な検索ニーズを満たす |
| ステータスフィルタ | 全ステータス対象 | DRAFTでも参照可能にするため |
| limit デフォルト | 10件（最大50件） | サジェストUIに適した件数 |
| ソート順 | status → name/orderKey | ACTIVE を優先表示 |
