# テストケース履歴のカテゴリ別グループ化が正しく動作しない問題

## 問題の概要

履歴APIのカテゴリ別セクション表示機能で、基本情報・前提条件・手順・期待結果が正しくグループ化されていない。

## 原因

### 2つの問題パターン

#### パターン1: Webフロントエンド - 各APIが独立したgroupId

フロントエンドで「保存」ボタンを押すと、複数のAPI呼び出しが個別に行われる：

```
保存ボタン押下時のAPI呼び出し順序:
1. PATCH /api/test-cases/{id}                    → groupId: aaa
2. DELETE /api/test-cases/{id}/preconditions/1   → groupId: bbb
3. POST /api/test-cases/{id}/preconditions       → groupId: ccc
4. PATCH /api/test-cases/{id}/steps/1            → groupId: ddd
```

**結果**: 同じ「保存」操作でも、各変更が異なるgroupIdを持ち、別々のグループとして表示される。

#### パターン2: MCPツール - changeDetailなしで1つの履歴

`updateWithChildren`メソッド（MCPツールが使用）は：
- 1つのgroupIdで全カテゴリを更新 ✓
- しかし**1つの履歴レコード**しか作成しない
- **changeDetailが設定されない**ため、カテゴリ別に分類できない

**結果**: 全ての変更がbasicInfoカテゴリに分類される。

## 解決策

### 共通方針: 各カテゴリの変更ごとに履歴レコードを作成し、同じgroupIdを共有

```
保存時の履歴作成:
履歴1: groupId=xxx, changeDetail={type: 'BASIC_INFO_UPDATE', ...}
履歴2: groupId=xxx, changeDetail={type: 'PRECONDITION_ADD', ...}
履歴3: groupId=xxx, changeDetail={type: 'STEP_UPDATE', ...}
履歴4: groupId=xxx, changeDetail={type: 'EXPECTED_RESULT_DELETE', ...}
```

## 実装内容

### 1. バックエンド - updateWithChildrenの修正 (優先)
**ファイル**: `apps/api/src/services/test-case.service.ts`

現在の`updateWithChildren`を修正し、各カテゴリの変更ごとに履歴レコードを作成：
- 基本情報の変更 → `BASIC_INFO_UPDATE`
- 前提条件の追加 → `PRECONDITION_ADD`
- 前提条件の更新 → `PRECONDITION_UPDATE`
- 前提条件の削除 → `PRECONDITION_DELETE`
- ステップ/期待結果も同様

全て同じgroupIdを共有する。

### 2. バックエンド - 個別APIにgroupIdパラメータ追加
**ファイル**:
- `apps/api/src/routes/test-cases.ts` - スキーマにgroupId追加
- `apps/api/src/controllers/test-case.controller.ts` - groupIdをサービスに渡す
- `apps/api/src/services/test-case.service.ts` - 全メソッドでgroupId受け取り

```typescript
// 各スキーマにgroupId追加
const updateTestCaseSchema = z.object({
  title: z.string().optional(),
  groupId: z.string().uuid().optional(),  // 追加
});

const addPreconditionSchema = z.object({
  content: z.string().min(1),
  groupId: z.string().uuid().optional(),  // 追加
});
// 他のスキーマも同様
```

### 3. フロントエンド - 保存時にgroupId共有
**ファイル**:
- `apps/web/src/lib/api.ts` - API型にgroupId追加
- `apps/web/src/components/test-case/TestCaseForm.tsx`

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  const groupId = crypto.randomUUID();  // 全API呼び出しで共有

  if (hasBasicChanges) {
    await testCasesApi.update(testCaseId, { ...changes, groupId });
  }
  await updateListItems(testCaseId, 'precondition', preconditions, groupId);
  await updateListItems(testCaseId, 'step', steps, groupId);
  await updateListItems(testCaseId, 'expectedResult', expectedResults, groupId);
};
```

### 4. MCPツール - 関数内でgroupIdを発行してAPIに渡す
**ファイル**: `apps/mcp-server/src/tools/update-test-case.ts`

MCPツール内部でgroupIdを生成し、バックエンドAPIに渡す。
Coding agent側はgroupIdを意識する必要なし。

```typescript
// update-test-case.ts
const updateTestCaseHandler = async (input, context) => {
  // MCPツール内でgroupIdを自動生成
  const groupId = crypto.randomUUID();

  // APIにgroupIdを含めて送信
  const response = await apiClient.patch(
    `/internal/api/test-cases/${testCaseId}`,
    { ...updateData, groupId },  // groupIdを追加
    { userId }
  );

  return response;
};
```

## 実装順序

1. **updateWithChildrenの修正** - カテゴリ別履歴作成（MCPツール対応）
2. **個別APIにgroupIdパラメータ追加** - バックエンド
3. **MCPツールでgroupId自動発行** - update-test-case.ts
4. **フロントエンドでgroupId共有** - TestCaseForm修正

## 対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/services/test-case.service.ts` | updateWithChildren修正、全メソッドにgroupIdパラメータ追加 |
| `apps/api/src/routes/test-cases.ts` | スキーマにgroupId追加 |
| `apps/api/src/controllers/test-case.controller.ts` | groupIdをサービスに渡す |
| `apps/mcp-server/src/tools/update-test-case.ts` | 関数内でgroupId生成してAPIに渡す |
| `apps/web/src/lib/api.ts` | API型にgroupId追加 |
| `apps/web/src/components/test-case/TestCaseForm.tsx` | groupId生成・送信 |

## 検証方法

### Webフロントエンド
1. テストケース編集画面で複数カテゴリを同時に変更
2. 保存後、履歴一覧で1つのグループにまとまっていることを確認
3. グループ展開時にカテゴリ別セクションが表示されることを確認

### MCPツール
1. MCPツールでテストケースを更新（coding agentはgroupIdを意識しない）
2. 履歴一覧で変更が1つのグループにまとまっていることを確認
3. カテゴリ別セクションが正しく表示されることを確認
