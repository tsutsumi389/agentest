# MCPツールのMarkdown対応明記

## 概要
MCPツールの説明、前提条件、手順、期待結果がMarkdown形式で記述可能であることをcoding agentに伝えるため、Zodスキーマの`.describe()`に「Markdown記法対応」を追記する。

## 変更対象ファイル

### 1. `apps/mcp-server/src/tools/create-test-case.ts`

**childEntitySchema（9行目）**
```typescript
content: z.string().min(1).max(10000).describe('テキスト内容（1-10000文字）。Markdown記法対応'),
```

**createTestCaseInputSchema（18行目）**
```typescript
description: z.string().max(2000).optional().describe('テストケースの説明（最大2000文字）。省略可。Markdown記法対応'),
```

**createTestCaseInputSchema（21-23行目）**
```typescript
preconditions: z.array(childEntitySchema).optional().describe('前提条件の配列。各要素は{content: "条件内容"}形式。テスト実行前に満たすべき条件を記述。contentはMarkdown記法対応'),
steps: z.array(childEntitySchema).optional().describe('テスト手順の配列。各要素は{content: "手順内容"}形式。実行すべき操作を順番に記述。contentはMarkdown記法対応'),
expectedResults: z.array(childEntitySchema).optional().describe('期待結果の配列。各要素は{content: "期待結果内容"}形式。各手順後に確認すべき結果を記述。contentはMarkdown記法対応'),
```

### 2. `apps/mcp-server/src/tools/update-test-case.ts`

**childEntityUpdateSchema（10行目）**
```typescript
content: z.string().min(1).max(10000).describe('テキスト内容（1-10000文字）。Markdown記法対応'),
```

**updateTestCaseInputSchema（19行目）**
```typescript
description: z.string().max(2000).nullable().optional().describe('新しい説明（最大2000文字）。nullを指定すると説明を削除。Markdown記法対応'),
```

**updateTestCaseInputSchema（22-24行目）**
```typescript
preconditions: z.array(childEntityUpdateSchema).optional().describe('前提条件の配列。差分更新: idあり→内容更新、idなし→新規追加、配列に含まれないid→削除。get_test_caseで現在のIDを確認可能。contentはMarkdown記法対応'),
steps: z.array(childEntityUpdateSchema).optional().describe('テスト手順の配列。差分更新: idあり→内容更新、idなし→新規追加、配列に含まれないid→削除。get_test_caseで現在のIDを確認可能。contentはMarkdown記法対応'),
expectedResults: z.array(childEntityUpdateSchema).optional().describe('期待結果の配列。差分更新: idあり→内容更新、idなし→新規追加、配列に含まれないid→削除。get_test_caseで現在のIDを確認可能。contentはMarkdown記法対応'),
```

### 3. `apps/mcp-server/src/tools/create-test-suite.ts`

**createTestSuiteInputSchema（11行目）**
```typescript
description: z.string().max(2000).optional().describe('テストスイートの説明（最大2000文字）。省略可。Markdown記法対応'),
```

### 4. `apps/mcp-server/src/tools/update-test-suite.ts`

**updateTestSuiteInputSchema（11行目）**
```typescript
description: z.string().max(2000).nullable().optional().describe('新しい説明（最大2000文字）。nullを指定すると説明を削除。Markdown記法対応'),
```

## 検証方法

1. MCPサーバーをビルド
```bash
docker compose exec dev pnpm build --filter=@agentest/mcp-server
```

2. ビルドが成功することを確認
