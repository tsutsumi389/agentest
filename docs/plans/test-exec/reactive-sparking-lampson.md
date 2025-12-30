# Step 4: 実行結果一覧 (EX-006) 実装計画

## 概要
テストスイート詳細ページに「実行履歴」専用タブを追加し、フィルタリング・ページネーション機能を実装する。

## タブ構成（変更後）
```
概要 → 実行履歴（新規） → 変更履歴（旧「履歴」） → 設定
```

## 実装ステップ

### Step 1: バックエンドAPI拡張

#### 1-1. Zodスキーマ追加
**ファイル**: `packages/shared/src/validators/schemas.ts`

```typescript
export const executionSearchSchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(executionStatusSchema).optional()),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['startedAt', 'completedAt', 'status']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ExecutionSearchParams = z.infer<typeof executionSearchSchema>;
```

#### 1-2. サービス層拡張
**ファイル**: `apps/api/src/services/test-suite.service.ts` (getExecutions: 475-492行)

変更内容:
- フィルタリング対応（status配列、from/to日付）
- 総件数（total）をレスポンスに追加
- ソートオプション対応

```typescript
async getExecutions(testSuiteId: string, options: ExecutionSearchOptions) {
  const where: Prisma.ExecutionWhereInput = {
    testSuiteId,
    ...(options.status?.length && { status: { in: options.status } }),
    ...(options.from && { startedAt: { gte: new Date(options.from) } }),
    ...(options.to && { startedAt: { lte: new Date(options.to) } }),
  };

  const [executions, total] = await Promise.all([
    prisma.execution.findMany({
      where,
      include: {
        executedByUser: { select: { id: true, name: true, avatarUrl: true } },
        environment: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { [options.sortBy || 'startedAt']: options.sortOrder || 'desc' },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.execution.count({ where }),
  ]);

  return { executions, total };
}
```

#### 1-3. コントローラー更新
**ファイル**: `apps/api/src/controllers/test-suite.controller.ts` (getExecutions: 240-250行)

変更内容:
- `executionSearchSchema`を使用
- レスポンスに`total`を追加

---

### Step 2: フロントエンドAPI型拡張

**ファイル**: `apps/web/src/lib/api.ts`

#### 2-1. 型定義追加
```typescript
export interface ExecutionSearchParams {
  status?: string[];
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'startedAt' | 'completedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}
```

#### 2-2. testSuitesApi.getExecutions更新 (747-755行付近)
- クエリパラメータ構築
- レスポンス型を `{ executions, total, limit, offset }` に変更

---

### Step 3: ExecutionHistoryListコンポーネント作成

**ファイル**: `apps/web/src/components/execution/ExecutionHistoryList.tsx` (新規)

#### 機能
- ステータスフィルタ（複数選択可能）
- 日付範囲フィルタ（すべて/今日/7日/30日）
- ページネーション（10/20/50件）
- 各実行へのリンク

#### 参考パターン
- `AuditLogList.tsx`: ページネーションUI、フィルタドロップダウン
- `TestSuiteSearchFilter.tsx`: フィルタバッジ表示

#### UI構成
```
┌─────────────────────────────────────────────────┐
│ フィルタ: [ステータス▼] [日付範囲▼]  [ページサイズ] │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ [●] 完了  production  yamada  2時間前      │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ [○] 実行中  staging  tanaka  5分前         │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ 50件中 1-20件を表示    [<] 1/3 [>]              │
└─────────────────────────────────────────────────┘
```

---

### Step 4: TestSuiteDetail.tsxの更新

**ファイル**: `apps/web/src/pages/TestSuiteDetail.tsx`

#### 4-1. タブ定義変更 (32-38行)
```typescript
type TabType = 'overview' | 'executions' | 'history' | 'settings';

const TABS = [
  { id: 'overview', label: '概要', icon: FileText },
  { id: 'executions', label: '実行履歴', icon: Play },  // 新規
  { id: 'history', label: '変更履歴', icon: History },  // 名称変更
  { id: 'settings', label: '設定', icon: Settings },
];
```

#### 4-2. タブコンテンツ追加
```typescript
{currentTab === 'executions' && (
  <ExecutionHistoryList testSuiteId={testSuiteId} />
)}
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/src/validators/schemas.ts` | executionSearchSchema追加 |
| `apps/api/src/services/test-suite.service.ts` | getExecutions拡張 |
| `apps/api/src/controllers/test-suite.controller.ts` | スキーマ・レスポンス更新 |
| `apps/web/src/lib/api.ts` | 型定義・APIメソッド更新 |
| `apps/web/src/components/execution/ExecutionHistoryList.tsx` | **新規作成** |
| `apps/web/src/pages/TestSuiteDetail.tsx` | タブ追加・統合 |

---

## 実装順序

1. バックエンド（schemas.ts → service → controller）
2. フロントエンドAPI（api.ts）
3. UIコンポーネント（ExecutionHistoryList.tsx）
4. ページ統合（TestSuiteDetail.tsx）
5. 動作確認
