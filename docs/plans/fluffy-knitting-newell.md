# Phase 4: テストスイート管理 - 実装計画

## 概要

テストスイート管理機能（TS-001〜TS-008、TS-005レビューは除く）を実装する。
基本CRUDは既に実装済みのため、以下の拡張機能を追加する。

## 対象機能

| ID | 機能 | 現状 | 追加作業 |
|------|------|------|---------|
| TS-001 | テストスイート作成 | 実装済み | 前提条件付き作成 |
| TS-002 | 前提条件管理 | 追加のみ | 更新・削除・並替 |
| TS-003 | 一覧表示 | 実装済み | - |
| TS-004 | 変更履歴 | 記録のみ | 一覧取得・復元 |
| TS-006 | 論理削除 | 実装済み | 復元機能 |
| TS-007/008 | 検索・フィルタ | なし | 新規実装 |

---

## Step 1: バックエンド - 権限ミドルウェア

### 1.1 requireTestSuiteRole ミドルウェア作成

**ファイル:** `apps/api/src/middleware/require-test-suite-role.ts` (新規)

```typescript
// テストスイートIDから親プロジェクトを取得し、プロジェクト権限をチェック
export function requireTestSuiteRole(
  roles: ProjectRole[],
  options?: { allowDeletedSuite?: boolean }
)
```

### 1.2 ルートに権限ミドルウェア適用

**ファイル:** `apps/api/src/routes/test-suites.ts`

- 全エンドポイントに `requireTestSuiteRole` を追加
- 削除・復元は `ADMIN` 権限必須

---

## Step 2: バックエンド - 前提条件管理API

### 2.1 エンドポイント追加

**ファイル:** `apps/api/src/routes/test-suites.ts`

| メソッド | パス | 権限 |
|---------|------|------|
| PATCH | /:testSuiteId/preconditions/:preconditionId | WRITE |
| DELETE | /:testSuiteId/preconditions/:preconditionId | WRITE |
| POST | /:testSuiteId/preconditions/reorder | WRITE |

### 2.2 サービス追加

**ファイル:** `apps/api/src/services/test-suite.service.ts`

```typescript
async updatePrecondition(testSuiteId, preconditionId, data)
async deletePrecondition(testSuiteId, preconditionId)
async reorderPreconditions(testSuiteId, preconditionIds[])
```

### 2.3 コントローラー追加

**ファイル:** `apps/api/src/controllers/test-suite.controller.ts`

---

## Step 3: バックエンド - 履歴・復元API

### 3.1 エンドポイント追加

**ファイル:** `apps/api/src/routes/test-suites.ts`

| メソッド | パス | 権限 |
|---------|------|------|
| GET | /:testSuiteId/histories | READ (allowDeletedSuite) |
| POST | /:testSuiteId/restore | ADMIN (allowDeletedSuite) |

### 3.2 リポジトリ追加

**ファイル:** `apps/api/src/repositories/test-suite.repository.ts`

```typescript
async findDeletedById(id)        // 削除済みスイート取得
async restore(id)                 // deletedAt を null に
async getHistories(id, options)   // 履歴一覧取得
async countHistories(id)          // 履歴件数
```

### 3.3 サービス追加

**ファイル:** `apps/api/src/services/test-suite.service.ts`

```typescript
async getHistories(testSuiteId, { limit, offset })
async restore(testSuiteId, userId)  // 30日以内チェック
```

---

## Step 4: バックエンド - 検索・フィルタAPI

### 4.1 バリデーションスキーマ追加

**ファイル:** `packages/shared/src/validators/schemas.ts`

```typescript
export const testSuiteSearchSchema = z.object({
  q: z.string().max(100).optional(),
  status: entityStatusSchema.optional(),
  createdBy: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeDeleted: z.coerce.boolean().default(false),
});
```

### 4.2 リポジトリ追加

**ファイル:** `apps/api/src/repositories/test-suite.repository.ts`

```typescript
async search(projectId, options)
// - 名前部分一致検索
// - 前提条件内容検索（OR条件）
// - ステータス・作成者・日付フィルタ
```

### 4.3 既存コントローラー拡張

**ファイル:** `apps/api/src/controllers/project.controller.ts`

- `getTestSuites` メソッドを検索パラメータ対応に拡張

---

## Step 5: フロントエンド - API関数追加

**ファイル:** `apps/web/src/lib/api.ts`

```typescript
// testSuitesApi に追加
updatePrecondition(testSuiteId, preconditionId, data)
deletePrecondition(testSuiteId, preconditionId)
reorderPreconditions(testSuiteId, preconditionIds[])
getHistories(testSuiteId, { limit, offset })
restore(testSuiteId)

// projectsApi に追加
searchTestSuites(projectId, params)
```

---

## Step 6: フロントエンド - 前提条件管理UI

### 6.1 コンポーネント作成

**ファイル:** `apps/web/src/components/test-suite/PreconditionList.tsx` (新規)

- ドラッグ&ドロップ並替（@dnd-kit/core）
- 編集・削除ボタン

**ファイル:** `apps/web/src/components/test-suite/PreconditionFormModal.tsx` (新規)

- 前提条件の作成・編集モーダル

### 6.2 TestSuiteDetailPage に統合

**ファイル:** `apps/web/src/pages/TestSuiteDetail.tsx`

- 前提条件セクションを追加

---

## Step 7: フロントエンド - 履歴・復元UI

### 7.1 コンポーネント作成

**ファイル:** `apps/web/src/components/test-suite/TestSuiteHistoryList.tsx` (新規)

- 履歴一覧表示（HistoryList を参考）
- 変更者（ユーザー/Agent）表示
- 変更内容の差分表示

**ファイル:** `apps/web/src/components/test-suite/DeleteTestSuiteSection.tsx` (新規)

- 削除セクション
- 復元ボタン（削除済みの場合）

### 7.2 TestSuiteDetailPage に統合

**ファイル:** `apps/web/src/pages/TestSuiteDetail.tsx`

- タブで「履歴」「設定（削除）」を追加

---

## Step 8: フロントエンド - 検索・フィルタUI

### 8.1 コンポーネント作成

**ファイル:** `apps/web/src/components/test-suite/TestSuiteSearchFilter.tsx` (新規)

- 検索ボックス
- ステータス・作成者・日付フィルタ

### 8.2 ProjectDetailPage に統合

**ファイル:** `apps/web/src/pages/ProjectDetail.tsx`

- テストスイート一覧に検索・フィルタを追加

---

## Step 9: テスト作成

### 9.1 ユニットテスト

**ファイル:** `apps/api/src/__tests__/unit/test-suite.service.test.ts`

- updatePrecondition / deletePrecondition / reorderPreconditions
- getHistories / restore
- search

### 9.2 統合テスト

**ファイル:** `apps/api/src/__tests__/integration/test-suite-preconditions.integration.test.ts` (新規)

**ファイル:** `apps/api/src/__tests__/integration/test-suite-history-restore.integration.test.ts` (新規)

**ファイル:** `apps/api/src/__tests__/integration/test-suite-search.integration.test.ts` (新規)

---

## 修正対象ファイル一覧

### 新規作成
- `apps/api/src/middleware/require-test-suite-role.ts`
- `apps/web/src/components/test-suite/PreconditionList.tsx`
- `apps/web/src/components/test-suite/PreconditionFormModal.tsx`
- `apps/web/src/components/test-suite/TestSuiteHistoryList.tsx`
- `apps/web/src/components/test-suite/DeleteTestSuiteSection.tsx`
- `apps/web/src/components/test-suite/TestSuiteSearchFilter.tsx`
- `apps/api/src/__tests__/integration/test-suite-preconditions.integration.test.ts`
- `apps/api/src/__tests__/integration/test-suite-history-restore.integration.test.ts`
- `apps/api/src/__tests__/integration/test-suite-search.integration.test.ts`

### 拡張
- `apps/api/src/routes/test-suites.ts`
- `apps/api/src/controllers/test-suite.controller.ts`
- `apps/api/src/services/test-suite.service.ts`
- `apps/api/src/repositories/test-suite.repository.ts`
- `packages/shared/src/validators/schemas.ts`
- `apps/api/src/controllers/project.controller.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/pages/TestSuiteDetail.tsx`
- `apps/web/src/pages/ProjectDetail.tsx`
- `apps/api/src/__tests__/unit/test-suite.service.test.ts`

---

## 実装順序

1. **Step 1-4**: バックエンドAPI（権限→前提条件→履歴・復元→検索）
2. **Step 5**: フロントエンドAPI関数
3. **Step 6-8**: フロントエンドUI（前提条件→履歴・復元→検索）
4. **Step 9**: テスト作成
