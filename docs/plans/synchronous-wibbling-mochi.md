# apps/jobs ユニットテスト・結合テスト実装計画

## 概要

`apps/jobs` のバッチ処理ジョブに対するユニットテストと結合テストを作成する。

## 対象ジョブ（5件）

| ジョブ | 機能 | 外部依存 |
|--------|------|---------|
| history-cleanup | FREEプランの30日経過履歴削除 | Prisma |
| history-expiry-notify | 削除7日前のFREEユーザーへ通知 | Prisma, SMTP |
| webhook-retry | 処理失敗Webhookの再処理 | Prisma |
| payment-event-cleanup | 90日以上前の処理済みイベント削除 | Prisma |
| subscription-sync | DB-Stripe間の状態同期チェック | Prisma, Stripe API |

## ディレクトリ構造

```
apps/jobs/
├── vitest.config.ts                      # 新規作成
├── src/
│   └── __tests__/
│       ├── setup/
│       │   ├── globalSetup.ts            # 新規: DBスキーマ同期
│       │   └── setup.ts                  # 新規: Prisma接続管理
│       ├── unit/
│       │   ├── history-cleanup.test.ts
│       │   ├── history-expiry-notify.test.ts
│       │   ├── webhook-retry.test.ts
│       │   ├── payment-event-cleanup.test.ts
│       │   └── subscription-sync.test.ts
│       └── integration/
│           ├── test-helpers.ts           # 新規: テストデータ作成
│           ├── history-cleanup.integration.test.ts
│           ├── history-expiry-notify.integration.test.ts
│           ├── webhook-retry.integration.test.ts
│           ├── payment-event-cleanup.integration.test.ts
│           └── subscription-sync.integration.test.ts
```

## 実装ファイル一覧

### Phase 1: テスト基盤（4ファイル）

| ファイル | 内容 |
|----------|------|
| `vitest.config.ts` | Vitest設定（globals, fileParallelism: false, setupFiles） |
| `src/__tests__/setup/globalSetup.ts` | DBスキーマ同期（`db:push`） |
| `src/__tests__/setup/setup.ts` | テスト用DB接続確認、Prisma接続管理 |
| `src/__tests__/integration/test-helpers.ts` | テストデータ作成ヘルパー |

### Phase 2: ユニットテスト（5ファイル）

各ジョブの外部依存をモックしてビジネスロジックをテスト。

| ファイル | モック対象 |
|----------|-----------|
| `payment-event-cleanup.test.ts` | prisma |
| `history-cleanup.test.ts` | prisma |
| `history-expiry-notify.test.ts` | prisma, sendEmail |
| `webhook-retry.test.ts` | prisma |
| `subscription-sync.test.ts` | prisma, getStripeClient |

### Phase 3: 結合テスト（5ファイル）

実際のテストDBを使用し、外部API（Stripe, SMTP）はモック。

## モック戦略

```typescript
// vi.hoisted() + vi.mock() パターン
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findMany: vi.fn() },
    // ...
  },
}));

vi.mock('../lib/prisma.js', () => ({ prisma: mockPrisma }));
```

## ユニットテストケース設計

### 1. payment-event-cleanup.test.ts
- PROCESSED状態の90日以上前イベント削除
- FAILED + リトライ上限到達の90日以上前イベント削除
- 削除件数のログ出力
- 残りイベントのステータス別集計

### 2. history-cleanup.test.ts
- FREEプランユーザーの30日以上前履歴削除
- TestCaseHistory, TestSuiteHistory, ProjectHistory全削除
- 個人プロジェクト（organizationId: null）のみ対象
- PROプランユーザーは対象外
- カーソルベースバッチ処理の動作確認

### 3. history-expiry-notify.test.ts
- 削除7日前のFREEユーザーへ通知メール送信
- 削除予定履歴がないユーザーはスキップ
- メール送信エラー時の継続処理
- 成功・失敗カウントの集計

### 4. webhook-retry.test.ts
- FAILEDステータスイベントの再処理
- 処理成功時にPROCESSED更新
- 処理失敗時にretryCount増加
- MAX_RETRY_COUNT以上は対象外
- 各イベントタイプ（invoice.paid, subscription.created等）のハンドラ

### 5. subscription-sync.test.ts
- Stripeクライアント未初期化時のスキップ
- DBとStripeのステータス不一致修正
- CANCELED時のUser.plan=FREE更新
- Stripe未検出エラー（resource_missing）処理
- 期間終了日の1日超誤差修正

## 結合テストケース設計

### 1. history-cleanup.integration.test.ts
- FREEユーザー + 31日前履歴 → 削除
- PROユーザー + 31日前履歴 → 残存
- FREEユーザー + 29日前履歴 → 残存
- 組織プロジェクト履歴 → 残存

### 2. history-expiry-notify.integration.test.ts
- 削除7日前履歴を持つFREEユーザーへの通知（SMTPモック）
- 削除対象履歴がないユーザーのスキップ

### 3. webhook-retry.integration.test.ts
- FAILEDイベント再処理 → Invoice/Subscription更新
- 処理失敗時のretryCount増加

### 4. payment-event-cleanup.integration.test.ts
- 古いPROCESSEDイベントの削除
- 新しいイベントは残存

### 5. subscription-sync.integration.test.ts
- Stripeモックでステータス不一致修正
- Stripe未検出時のCANCELED化

## test-helpers.ts に追加する関数

```typescript
// PaymentEvent作成
createTestPaymentEvent(overrides)

// N日前の日付生成
daysAgo(days: number): Date

// 履歴削除テスト用データセット作成
createHistoryCleanupTestData(options: { historyAge: number })

// apps/api の test-helpers.ts から流用可能
// - createTestUser, createTestProject, createTestSuite, createTestCase
// - createTestCaseHistory, createTestSuiteHistory, createTestProjectHistory
// - createTestSubscription, cleanupTestData
```

## 修正対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `apps/jobs/vitest.config.ts` | 新規作成 |
| `apps/jobs/src/__tests__/setup/globalSetup.ts` | 新規作成 |
| `apps/jobs/src/__tests__/setup/setup.ts` | 新規作成 |
| `apps/jobs/src/__tests__/integration/test-helpers.ts` | 新規作成 |
| `apps/jobs/src/__tests__/unit/*.test.ts` | 5ファイル新規作成 |
| `apps/jobs/src/__tests__/integration/*.integration.test.ts` | 5ファイル新規作成 |

## 検証方法

```bash
# Dockerコンテナ内でテスト実行
docker compose exec dev pnpm --filter @agentest/jobs test

# ウォッチモード
docker compose exec dev pnpm --filter @agentest/jobs test:watch

# カバレッジ
docker compose exec dev pnpm --filter @agentest/jobs test -- --coverage
```

## 参考ファイル

- `apps/api/vitest.config.ts` - Vitest設定のリファレンス
- `apps/api/src/__tests__/setup/setup.ts` - セットアップパターン
- `apps/api/src/__tests__/integration/test-helpers.ts` - テストヘルパー実装例
- `apps/api/src/__tests__/unit/webhook.service.test.ts` - vi.hoisted()モックパターン
