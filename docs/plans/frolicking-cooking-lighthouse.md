# ラベル機能 API テスト実装計画

## 概要
ラベル機能（プロジェクトラベル管理 + テストスイートラベル付与）のユニットテストと結合テストを作成する。

---

## 作成するファイル

| ファイル | 説明 |
|---------|------|
| `apps/api/src/__tests__/unit/label.repository.test.ts` | Repository層ユニットテスト |
| `apps/api/src/__tests__/unit/label.service.test.ts` | Service層ユニットテスト |
| `apps/api/src/__tests__/unit/label.controller.test.ts` | Controller層ユニットテスト |
| `apps/api/src/__tests__/integration/labels.integration.test.ts` | 結合テスト |

## 修正するファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/__tests__/integration/test-helpers.ts` | `createTestLabel`, `createTestSuiteLabel` 追加、`cleanupTestData` にラベル削除追加 |

---

## Phase 1: テストヘルパー準備

### test-helpers.ts への追加

```typescript
// createTestLabel関数を追加
export async function createTestLabel(
  projectId: string,
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    color: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.label.create({
    data: {
      id,
      projectId,
      name: overrides.name ?? `Label ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
      color: overrides.color ?? '#3B82F6',
    },
  });
}

// createTestSuiteLabel関数を追加
export async function createTestSuiteLabel(testSuiteId: string, labelId: string) {
  return prisma.testSuiteLabel.create({
    data: { testSuiteId, labelId },
  });
}
```

### cleanupTestData への追加
`testSuite.deleteMany` の前に以下を追加:
```typescript
await prisma.testSuiteLabel.deleteMany({});
await prisma.label.deleteMany({});
```

---

## Phase 2: ユニットテスト

### 2.1 label.repository.test.ts

**モック構成:**
- `vi.hoisted()` で Prisma label, testSuiteLabel, $transaction をモック

**テストケース（17件）:**

| メソッド | テストケース |
|---------|-------------|
| findByProjectId | プロジェクトのラベル一覧を取得できる |
| findByProjectId | 結果はname昇順でソートされる |
| findById | IDでラベルを取得できる |
| findById | 存在しない場合はnullを返す |
| findByProjectIdAndName | プロジェクトと名前でラベルを取得できる |
| findByProjectIdAndName | 存在しない場合はnullを返す |
| create | ラベルを作成できる |
| create | descriptionなしで作成できる |
| update | nameを更新できる |
| update | colorを更新できる |
| update | descriptionをnullに更新できる |
| delete | ラベルを削除できる |
| validateLabelsBelongToProject | 全てのラベルが属していればtrueを返す |
| validateLabelsBelongToProject | 一部が属していなければfalseを返す |
| validateLabelsBelongToProject | 空配列はtrueを返す |
| getTestSuiteLabels | テストスイートのラベル一覧を取得できる |
| updateTestSuiteLabels | ラベルを一括更新できる |

### 2.2 label.service.test.ts

**モック構成:**
- LabelRepository, ProjectRepository, TestSuiteRepository をモック

**テストケース（20件）:**

| メソッド | テストケース | エラー |
|---------|-------------|--------|
| getByProjectId | プロジェクトのラベル一覧を取得できる | - |
| getByProjectId | 存在しないプロジェクト | NotFoundError |
| create | ラベルを作成できる | - |
| create | 存在しないプロジェクト | NotFoundError |
| create | 同名ラベルが存在する | ConflictError |
| update | ラベルを更新できる | - |
| update | 部分更新が可能 | - |
| update | 存在しないラベル | NotFoundError |
| update | 別プロジェクトのラベル | NotFoundError |
| update | 名前変更時に重複がある | ConflictError |
| update | 同じ名前への変更は許可 | - |
| delete | ラベルを削除できる | - |
| delete | 存在しないラベル | NotFoundError |
| delete | 別プロジェクトのラベル | NotFoundError |
| validateLabelsBelongToProject | 有効なラベルは成功 | - |
| validateLabelsBelongToProject | 無効なラベル | ValidationError |
| getTestSuiteLabels | テストスイートのラベルを取得できる | - |
| getTestSuiteLabels | 存在しないテストスイート | NotFoundError |
| updateTestSuiteLabels | テストスイートのラベルを更新できる | - |
| updateTestSuiteLabels | 存在しないテストスイート | NotFoundError |

### 2.3 label.controller.test.ts

**モック構成:**
- LabelService をモック
- mockRequest, mockResponse, mockNext を作成

**テストケース（12件）:**

| メソッド | テストケース |
|---------|-------------|
| getLabels | ラベル一覧を取得できる |
| getLabels | エラーをnextに渡す |
| createLabel | ラベルを作成できる（201） |
| createLabel | バリデーションエラーをnextに渡す |
| updateLabel | ラベルを更新できる |
| updateLabel | 部分更新が可能 |
| deleteLabel | ラベルを削除できる（204） |
| deleteLabel | エラーをnextに渡す |
| getTestSuiteLabels | テストスイートのラベルを取得できる |
| getTestSuiteLabels | エラーをnextに渡す |
| updateTestSuiteLabels | テストスイートのラベルを更新できる |
| updateTestSuiteLabels | 空配列で更新できる |

---

## Phase 3: 結合テスト

### labels.integration.test.ts

**テスト構成:**
- 認証ミドルウェア（@agentest/auth）をモック
- requireProjectRole, requireTestSuiteRole をモック
- setTestAuth/clearTestAuth 関数で認証状態を制御

**セットアップ:**
```typescript
// ユーザー作成: owner, admin, writer, reader
// プロジェクト作成
// プロジェクトメンバー追加: ADMIN, WRITE, READ
// テストスイート作成
```

### テストケース一覧

#### GET /api/projects/:projectId/labels

| テストケース | 期待結果 |
|-------------|---------|
| ラベル一覧を取得できる | 200, labels配列 |
| 空の場合は空配列を返す | 200, labels: [] |
| name昇順でソートされる | 200 |
| 未認証の場合 | 401 |
| READ権限で取得できる | 200 |
| 権限がない場合 | 403 |
| 存在しないプロジェクト | 404 |

#### POST /api/projects/:projectId/labels

| テストケース | 期待結果 |
|-------------|---------|
| ラベルを作成できる | 201 |
| 全フィールド指定で作成できる | 201 |
| 空のnameはエラー | 400 |
| 51文字以上のnameはエラー | 400 |
| 201文字以上のdescriptionはエラー | 400 |
| 無効なcolor形式はエラー | 400 |
| 同名ラベルは重複エラー | 409 |
| READ権限では作成できない | 403 |
| WRITE権限で作成できる | 201 |
| ADMIN権限で作成できる | 201 |

#### PATCH /api/projects/:projectId/labels/:labelId

| テストケース | 期待結果 |
|-------------|---------|
| nameを更新できる | 200 |
| colorを更新できる | 200 |
| descriptionを更新できる | 200 |
| descriptionをnullに更新できる | 200 |
| 部分更新が可能 | 200 |
| 存在しないラベル | 404 |
| 別プロジェクトのラベル | 404 |
| 同名への変更で重複エラー | 409 |
| READ権限では更新できない | 403 |
| WRITE権限で更新できる | 200 |

#### DELETE /api/projects/:projectId/labels/:labelId

| テストケース | 期待結果 |
|-------------|---------|
| ラベルを削除できる | 204 |
| 削除後にDBから消えている | DB確認 |
| 存在しないラベル | 404 |
| 別プロジェクトのラベル | 404 |
| READ権限では削除できない | 403 |
| WRITE権限では削除できない | 403 |
| ADMIN権限のみ削除できる | 204 |

#### GET /api/test-suites/:testSuiteId/labels

| テストケース | 期待結果 |
|-------------|---------|
| テストスイートのラベルを取得できる | 200 |
| ラベルがない場合は空配列 | 200, [] |
| name昇順でソートされる | 200 |
| 存在しないテストスイート | 404 |
| READ権限で取得できる | 200 |

#### PUT /api/test-suites/:testSuiteId/labels

| テストケース | 期待結果 |
|-------------|---------|
| ラベルを一括更新できる | 200 |
| 複数ラベルを設定できる | 200 |
| 空配列で全削除できる | 200, [] |
| 存在しないラベルID | 400 |
| 別プロジェクトのラベルID | 400 |
| 無効なUUID形式 | 400 |
| 存在しないテストスイート | 404 |
| READ権限では更新できない | 403 |
| WRITE権限で更新できる | 200 |

---

## 実装順序

1. **test-helpers.ts** にヘルパー関数追加
2. **label.repository.test.ts** 作成
3. **label.service.test.ts** 作成
4. **label.controller.test.ts** 作成
5. **labels.integration.test.ts** 作成
6. `pnpm test` で全テスト実行・確認

---

## 検証方法

```bash
# コンテナ内でテスト実行
docker compose exec dev pnpm --filter @agentest/api test

# 特定ファイルのみ実行
docker compose exec dev pnpm --filter @agentest/api test src/__tests__/unit/label

# 結合テストのみ実行
docker compose exec dev pnpm --filter @agentest/api test src/__tests__/integration/labels
```

---

## 参照ファイル

- `apps/api/src/repositories/label.repository.ts` - テスト対象
- `apps/api/src/services/label.service.ts` - テスト対象
- `apps/api/src/controllers/label.controller.ts` - テスト対象
- `apps/api/src/__tests__/integration/test-suite-preconditions.integration.test.ts` - 結合テストパターン参照
- `apps/api/src/__tests__/unit/session.service.test.ts` - サービステストパターン参照
