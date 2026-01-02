# MCPツール create_test_case / update_test_case 拡張計画

## 概要
MCPツールの`create_test_case`と`update_test_case`を拡張し、preconditions/steps/expectedResultsを一緒に登録・更新できるようにする。

## 更新方式
- **create**: 子エンティティを配列で受け取り一括登録
- **update**: 差分更新（idあり→更新、idなし→追加、リクエストにないid→削除）

---

## 修正対象ファイル

### 1. 型定義
**`packages/shared/src/types/test-case.ts`**
- `ChildEntityUpdateInput` 型を追加: `{ id?: string; content: string }`
- `TestCaseUpdateInput` を拡張: preconditions/steps/expectedResults を追加

### 2. サービス層
**`apps/api/src/services/test-case.service.ts`**
- `create()` メソッド拡張: 子エンティティの一括登録（createMany使用）
- `updateWithChildren()` メソッド新規追加: 差分更新ロジック
- `syncChildEntities()` プライベートメソッド追加: 差分同期処理

### 3. 内部APIエンドポイント
**`apps/api/src/routes/internal.ts`**
- POST `/internal/api/test-cases` スキーマ拡張
- PATCH `/internal/api/test-cases/:testCaseId` スキーマ拡張
- 子エンティティ含む場合は `updateWithChildren()` を呼び出し

### 4. MCPツール
**`apps/mcp-server/src/tools/create-test-case.ts`**
- 入力スキーマに preconditions/steps/expectedResults 追加
- レスポンス型に子エンティティ追加
- ツール説明文更新

**`apps/mcp-server/src/tools/update-test-case.ts`**
- 入力スキーマに preconditions/steps/expectedResults 追加（id付き）
- レスポンス型に子エンティティ追加
- ツール説明文更新

### 5. テスト
**ユニットテスト**
- `apps/mcp-server/src/__tests__/unit/tools/create-test-case.test.ts`
- `apps/mcp-server/src/__tests__/unit/tools/update-test-case.test.ts`

**結合テスト**
- `apps/api/src/__tests__/integration/internal-api-create.integration.test.ts`
- `apps/api/src/__tests__/integration/internal-api-update.integration.test.ts`

---

## 実装詳細

### 子エンティティスキーマ（MCP）
```typescript
// 作成用
const childEntitySchema = z.object({
  content: z.string().min(1).max(10000).describe('テキスト内容'),
});

// 更新用
const childEntityUpdateSchema = z.object({
  id: z.string().uuid().optional().describe('既存エンティティのID（省略時は新規作成）'),
  content: z.string().min(1).max(10000).describe('テキスト内容'),
});
```

### 差分更新ロジック（syncChildEntities）
```typescript
async syncChildEntities(tx, testCaseId, entityType, items) {
  // 1. 既存エンティティを取得
  const existing = await model.findMany({ where: { testCaseId } });
  const existingIds = new Set(existing.map(e => e.id));

  // 2. リクエストに含まれるIDのセット
  const requestIds = new Set(items.filter(i => i.id).map(i => i.id));

  // 3. 削除: リクエストに含まれないIDは削除
  const toDelete = [...existingIds].filter(id => !requestIds.has(id));
  if (toDelete.length) await model.deleteMany({ where: { id: { in: toDelete } } });

  // 4. 更新/作成を処理
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const orderKey = indexToOrderKey(i);

    if (item.id && existingIds.has(item.id)) {
      await model.update({ where: { id: item.id }, data: { content: item.content, orderKey } });
    } else {
      await model.create({ data: { testCaseId, content: item.content, orderKey } });
    }
  }
}
```

---

## 実装順序

1. **型定義の拡張** (`packages/shared/src/types/test-case.ts`)
2. **サービス層の拡張** (`apps/api/src/services/test-case.service.ts`)
3. **内部APIの拡張** (`apps/api/src/routes/internal.ts`)
4. **MCPツールの拡張** (`apps/mcp-server/src/tools/`)
5. **テスト追加・実行**

---

## 考慮事項

- **トランザクション**: 全操作は単一トランザクション内で実行
- **orderKey**: `indexToOrderKey(index)` で自動生成
- **履歴**: JSONスナップショット形式で子エンティティ含む
- **バリデーション**: 他のテストケースのidを指定した場合はエラー
- **後方互換性**: 子エンティティパラメータはオプショナル
