# WebSocketリアルタイム更新機能 テスト実装計画

## 概要

`partitioned-plotting-mist.md`で実装されたWebSocketリアルタイム更新機能のユニットテスト・結合テストを作成する。

## 対象

### バックエンド（テスト基盤あり）
| ファイル | テスト対象 |
|---------|----------|
| `apps/api/src/lib/events.ts` | イベント発行ヘルパー（2関数） |
| `apps/api/src/services/test-suite.service.ts` | 5メソッドのイベント発行 |
| `apps/api/src/services/test-case.service.ts` | 14メソッドのイベント発行 |

### フロントエンド（テスト基盤なし）
| ファイル | 備考 |
|---------|-----|
| `apps/web/src/hooks/useTestSuiteRealtime.ts` | vitest未導入 |
| `apps/web/src/hooks/useTestCaseRealtime.ts` | testing-library未導入 |
| `apps/web/src/components/test-suite/PreconditionList.tsx` | テスト設定なし |

## 実装計画

### Phase 1: バックエンドユニットテスト

#### 1.1 events.ts のテスト
**ファイル**: `apps/api/src/__tests__/unit/events.test.ts`

```typescript
describe('events.ts - イベント発行ヘルパー', () => {
  describe('publishTestSuiteUpdated', () => {
    it('REDIS_URL未設定時は何もしない')
    it('2つのチャンネル（project, testSuite）にイベントを発行する')
    it('イベント形式が正しい（type, eventId, timestamp, changes, updatedBy）')
    it('Redis publish失敗時はログ出力のみで例外を投げない')
  })

  describe('publishTestCaseUpdated', () => {
    it('REDIS_URL未設定時は何もしない')
    it('3つのチャンネル（project, testSuite, testCase）にイベントを発行する')
    it('イベント形式が正しい')
    it('Redis publish失敗時はログ出力のみで例外を投げない')
  })
})
```

**モック方法**:
```typescript
const mockPublish = vi.fn();
vi.mock('ioredis', () => ({
  Redis: vi.fn(() => ({ publish: mockPublish, quit: vi.fn(), on: vi.fn() })),
}));
```

#### 1.2 TestSuiteService イベント発行テスト
**ファイル**: `apps/api/src/__tests__/unit/test-suite.service.events.test.ts`

```typescript
describe('TestSuiteService - イベント発行', () => {
  describe('addPrecondition', () => {
    it('publishTestSuiteUpdatedが正しい引数で呼ばれる')
    it('changes配列が正しい（field: precondition:add）')
    it('イベント発行エラー時もメイン処理は成功する')
  })
  // updatePrecondition, deletePrecondition, reorderPreconditions, reorderTestCases
})
```

#### 1.3 TestCaseService イベント発行テスト
**ファイル**: `apps/api/src/__tests__/unit/test-case.service.events.test.ts`

```typescript
describe('TestCaseService - イベント発行', () => {
  // 前提条件: addPrecondition, updatePrecondition, deletePrecondition, reorderPreconditions
  // 手順: addStep, updateStep, deleteStep, reorderSteps
  // 期待結果: addExpectedResult, updateExpectedResult, deleteExpectedResult, reorderExpectedResults
  // その他: copy, updateWithChildren
})
```

### Phase 2: バックエンド結合テスト

#### 2.1 テストスイートイベント結合テスト
**ファイル**: `apps/api/src/__tests__/integration/test-suite-events.integration.test.ts`

```typescript
describe('Test Suite Events Integration', () => {
  it('POST /api/test-suites/:id/preconditions でイベントが発行される')
  it('PATCH /api/test-suites/:id/preconditions/:id でイベントが発行される')
  it('DELETE /api/test-suites/:id/preconditions/:id でイベントが発行される')
  it('PUT /api/test-suites/:id/preconditions/reorder でイベントが発行される')
  it('PUT /api/test-suites/:id/test-cases/reorder でイベントが発行される')
})
```

#### 2.2 テストケースイベント結合テスト
**ファイル**: `apps/api/src/__tests__/integration/test-case-events.integration.test.ts`

同様のパターンで14メソッドをカバー。

## 検証方法

```bash
# ユニットテスト実行
cd docker && docker compose exec dev pnpm --filter @agentest/api test

# 特定テストファイル実行
docker compose exec dev pnpm --filter @agentest/api test events.test.ts
```

## 作成ファイル一覧

| ファイル | 種類 |
|---------|-----|
| `apps/api/src/__tests__/unit/events.test.ts` | ユニットテスト |
| `apps/api/src/__tests__/unit/test-suite.service.events.test.ts` | ユニットテスト |
| `apps/api/src/__tests__/unit/test-case.service.events.test.ts` | ユニットテスト |
| `apps/api/src/__tests__/integration/test-suite-events.integration.test.ts` | 結合テスト |
| `apps/api/src/__tests__/integration/test-case-events.integration.test.ts` | 結合テスト |
