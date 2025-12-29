# テストケース履歴取得・復元API（TC-005）実装計画

## 概要

テストケース管理機能の履歴取得・復元APIを実装する。履歴保存は実装済みのため、取得・復元エンドポイントを追加。

## エンドポイント

```
GET  /api/test-cases/:testCaseId/histories?limit=20&offset=0
POST /api/test-cases/:testCaseId/restore
```

## 権限

| エンドポイント | 権限 | 削除済みアクセス |
|---------------|------|-----------------|
| 履歴取得 | READ以上 | 可能 |
| 復元 | ADMIN以上 | 必須 |

## 制約

- 復元は削除から30日以内のみ可能
- 削除済みテストスイートへの復元は不可

---

## 実装タスク

### 1. リポジトリ層 - test-case.repository.ts

**追加メソッド:**

```typescript
// 履歴一覧取得
async getHistories(id: string, options: { limit: number; offset: number })

// 履歴件数取得
async countHistories(id: string)

// 削除済みテストケース取得
async findDeletedById(id: string)

// 復元（deletedAtをnullに設定）
async restore(id: string)
```

### 2. サービス層 - test-case.service.ts

**追加メソッド:**

```typescript
// 履歴一覧取得（削除済みテストケースも対象）
async getHistories(testCaseId: string, options: { limit: number; offset: number })
  - テストケース存在確認（削除済み含む）
  - リポジトリから履歴取得
  - 総件数も返却

// 復元
async restore(testCaseId: string, userId: string)
  - 削除済みテストケース取得
  - 未削除の場合: ConflictError
  - 30日制限チェック: 超過時 BadRequestError
  - テストスイート存在・未削除確認
  - トランザクション内で履歴保存（RESTORE）+ 復元
```

### 3. コントローラー層 - test-case.controller.ts

**追加メソッド:**

```typescript
// 履歴取得ハンドラー
getHistories = async (req, res, next) => {
  // クエリパラメータ: limit (default: 20, max: 100), offset (default: 0)
}

// 復元ハンドラー
restore = async (req, res, next) => {
  // req.user.id を使用して履歴記録
}
```

**追加スキーマ:**

```typescript
const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
```

### 4. ルート定義 - test-cases.ts

```typescript
// 履歴取得
router.get('/:testCaseId/histories', requireAuth(authConfig), testCaseController.getHistories);

// 復元
router.post('/:testCaseId/restore', requireAuth(authConfig), testCaseController.restore);
```

**注**: 既存パターンに従い`requireAuth`のみ使用。権限チェックはサービス層で実施。

---

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/repositories/test-case.repository.ts` | 4メソッド追加 |
| `apps/api/src/services/test-case.service.ts` | 2メソッド追加 |
| `apps/api/src/controllers/test-case.controller.ts` | 2メソッド追加 |
| `apps/api/src/routes/test-cases.ts` | 2エンドポイント追加 |

## 参照実装

- `apps/api/src/services/test-suite.service.ts` - getHistories, restore
- `apps/api/src/repositories/test-suite.repository.ts` - getHistories, countHistories, findDeletedById, restore

---

## エラーハンドリング

| 状況 | エラー | HTTP |
|-----|-------|------|
| テストケースなし | NotFoundError | 404 |
| 未削除の復元 | ConflictError | 409 |
| 30日超過 | BadRequestError | 400 |
| 削除済みスイートへの復元 | BadRequestError | 400 |
| 権限不足 | AuthorizationError | 403 |

---

## テスト

### ユニットテスト（新規）

`apps/api/src/__tests__/services/test-case.service.history.test.ts`

- getHistories: 正常取得、ページネーション、削除済み対象、件数0
- restore: 正常復元、履歴作成、30日制限、未削除エラー、削除済みスイートエラー

### 統合テスト（新規）

`apps/api/src/__tests__/integration/test-case-history-restore.integration.test.ts`

- GET /histories: ページネーション、権限、削除済み対象
- POST /restore: ADMIN成功、WRITE/READ拒否、30日制限、削除済みスイート拒否

---

## 実装順序

1. リポジトリ層（4メソッド）
2. サービス層（2メソッド + 権限チェック）
3. コントローラー層（2メソッド）
4. ルート定義（2エンドポイント）
5. ユニットテスト
6. 統合テスト
