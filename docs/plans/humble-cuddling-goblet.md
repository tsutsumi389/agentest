# テストケース変更履歴のバックエンドグループ化

## 概要

フロントエンドで行っている履歴のグループ化処理をバックエンドに移動し、ページ境界をまたぐグループの分断問題を解決する。

## 現状の問題

- フロントエンドでページ単位で取得した履歴をグループ化
- 同じgroupIdを持つ履歴がページ境界をまたぐと別々のグループとして表示される
- ページネーションが履歴レコード単位でグループ単位ではない

## レスポンス構造の変更

**現在:**
```typescript
{ histories: TestCaseHistory[], total: number }
```

**変更後:**
```typescript
{ items: TestCaseHistoryGroupedItem[], totalGroups: number, total: number }
```

## 修正対象ファイル

| 順序 | ファイル | 変更内容 |
|-----|---------|---------|
| 1 | `packages/shared/src/types/test-case.ts` | `TestCaseHistoryGroupedItem`型追加 |
| 2 | `apps/api/src/repositories/test-case.repository.ts` | `getHistoriesGrouped`メソッド追加 |
| 3 | `apps/api/src/services/test-case.service.ts` | `getHistoriesGrouped`メソッド追加 |
| 4 | `apps/api/src/controllers/test-case.controller.ts` | レスポンス形式変更 |
| 5 | `apps/web/src/lib/api.ts` | API型更新 |
| 6 | `apps/web/src/components/test-case/TestCaseHistoryList.tsx` | グループ化ロジック削除 |

## 実装詳細

### 1. 型定義追加 (`packages/shared/src/types/test-case.ts`)

```typescript
/** グループ化された履歴アイテム */
export interface TestCaseHistoryGroupedItem {
  groupId: string | null;  // nullの場合は単一履歴
  histories: TestCaseHistory[];
  createdAt: Date;
}

/** 履歴一覧レスポンス（グループ化版） */
export interface TestCaseHistoriesGroupedResponse {
  items: TestCaseHistoryGroupedItem[];
  totalGroups: number;
  total: number;  // 後方互換性
}
```

### 2. Repository層 (`apps/api/src/repositories/test-case.repository.ts`)

```typescript
async getHistoriesGrouped(id: string, options: { limit: number; offset: number }) {
  // 1. グループ総数を取得
  const countResult = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT COALESCE(group_id, id::text)) as group_count
    FROM test_case_histories WHERE test_case_id = ${id}::uuid
  `;

  // 2. 対象グループIDを取得（ページネーション）
  const groupIds = await prisma.$queryRaw`
    WITH grouped AS (
      SELECT COALESCE(group_id, id::text) as effective_group_id,
             MIN(created_at) OVER (...) as group_created_at
      FROM test_case_histories WHERE test_case_id = ${id}::uuid
    )
    SELECT DISTINCT effective_group_id, group_created_at
    FROM grouped ORDER BY group_created_at DESC
    LIMIT ${options.limit} OFFSET ${options.offset}
  `;

  // 3. 該当グループの全履歴を取得
  const histories = await prisma.testCaseHistory.findMany({
    where: { testCaseId: id, ... },
    include: { changedBy: {...}, agentSession: {...} },
    orderBy: { createdAt: 'desc' },
  });

  // 4. グループ化して返却
  return { items, totalGroups, totalHistories };
}
```

### 3. Service層 (`apps/api/src/services/test-case.service.ts`)

```typescript
async getHistoriesGrouped(testCaseId: string, options: { limit: number; offset: number }) {
  const testCase = await prisma.testCase.findUnique({ where: { id: testCaseId } });
  if (!testCase) throw new NotFoundError('TestCase', testCaseId);
  return this.testCaseRepo.getHistoriesGrouped(testCaseId, options);
}
```

### 4. Controller層 (`apps/api/src/controllers/test-case.controller.ts`)

```typescript
getHistories = async (req, res, next) => {
  const { testCaseId } = req.params;
  const { limit, offset } = paginationQuerySchema.parse(req.query);
  const result = await this.testCaseService.getHistoriesGrouped(testCaseId, { limit, offset });
  res.json({
    items: result.items,
    totalGroups: result.totalGroups,
    total: result.totalHistories,
  });
};
```

### 5. フロントエンドAPI型 (`apps/web/src/lib/api.ts`)

```typescript
export interface TestCaseHistoryGroupedItem {
  groupId: string | null;
  histories: TestCaseHistory[];
  createdAt: string;
}

// getHistoriesの戻り値型を更新
```

### 6. フロントエンド簡素化 (`apps/web/src/components/test-case/TestCaseHistoryList.tsx`)

- `groupHistories()`関数を削除
- `isHistoryGroup()`関数を削除
- APIレスポンスの`items`をそのまま使用
- ページネーションを`totalGroups`ベースに変更

## 検証方法

1. **型チェック**: `docker compose exec dev pnpm typecheck`
2. **単体テスト**: `docker compose exec dev pnpm test`
3. **手動検証**:
   - テストケースの複数フィールドを同時更新
   - 変更履歴画面でグループ表示を確認
   - ページネーションで2ページ目以降を確認
   - 既存データ（groupIdがNULL）が正しく表示されることを確認
