# 1-4. プラン制限・使用量管理の削除（TDD実装計画）

## Context

OSS移行（SaaS→セルフホスト）の一環で、プラン制限・使用量管理を完全に除去する。
マスタープラン `docs/plans/jolly-crunching-pond.md` のセクション 1-4 および 2-4 に該当。

コミット #231-#233 で大部分は削除済み（UsageRecord, プランEnum, plan-pricing.ts, フロントエンドUI 等）。
残作業は以下の3点:

1. **history-cleanup ジョブの環境変数対応**（セクション 2-4）: `HISTORY_RETENTION_DAYS` のハードコード → 環境変数化
2. **packages/shared/vitest.config.ts** のクリーンアップ: 削除済み `plan-pricing.ts` への参照除去
3. **batch-processing.md** の環境変数テーブル更新

---

## 変更対象ファイル

| ファイル | 変更種別 |
|---------|---------|
| `apps/jobs/src/__tests__/unit/history-cleanup.test.ts` | 修正（環境変数テスト追加） |
| `apps/jobs/src/__tests__/unit/plan-removal.test.ts` | **新規**（回帰テスト） |
| `apps/jobs/src/jobs/history-cleanup.ts` | 修正（環境変数対応） |
| `packages/shared/vitest.config.ts` | 修正（L19 削除） |
| `docs/architecture/features/batch-processing.md` | 修正（環境変数テーブル追加） |

---

## Phase 1: RED（テスト作成）

### Step 1-1. history-cleanup ユニットテストに環境変数テストを追加

**ファイル:** `apps/jobs/src/__tests__/unit/history-cleanup.test.ts`

既存の `beforeEach` に `delete process.env.HISTORY_RETENTION_DAYS` を追加し、新しい `describe` ブロックで以下のテストケースを追加:

| テストケース | 環境変数値 | 期待する保持日数 |
|------------|-----------|---------------|
| 未設定時はデフォルト30日 | `undefined` | 30 |
| `'90'` 指定時は90日 | `'90'` | 90 |
| `'7'` 指定時は7日 | `'7'` | 7 |
| `'0'` はデフォルトにフォールバック | `'0'` | 30 |
| 負数はデフォルトにフォールバック | `'-10'` | 30 |
| 非数値はデフォルトにフォールバック | `'abc'` | 30 |
| 小数は整数部のみ使用 | `'45.7'` | 45 |
| 無効値で警告ログ出力 | `'invalid'` | 30（+ `logger.warn`） |

**設計ポイント:** `process.env` を関数呼び出し時に毎回参照する設計とし、モジュール再ロード不要でテスト間切り替え可能にする。`afterEach` で環境変数を復元。

### Step 1-2. プラン制限・UsageRecord 削除の回帰テスト作成

**ファイル:** `apps/jobs/src/__tests__/unit/plan-removal.test.ts`（新規）

`metrics-removal.test.ts` と同じパターン（ファイル存在チェック + コンテンツチェック）で以下を検証:

- `packages/shared/src/config/plan-pricing.ts` が存在しないこと
- `history-cleanup.ts` に `UserPlan`, `OrganizationPlan`, `PLAN_LIMITS`, `FREE`, `PRO`, `UsageRecord` の参照がないこと
- `history-cleanup.ts` が `process.env` と `HISTORY_RETENTION_DAYS` を含むこと（環境変数対応の確認）

### Step 1-3. テスト実行で RED を確認

```bash
docker compose exec dev pnpm --filter @agentest/jobs test -- --reporter verbose src/__tests__/unit/history-cleanup.test.ts
docker compose exec dev pnpm --filter @agentest/jobs test -- --reporter verbose src/__tests__/unit/plan-removal.test.ts
```

**期待:** 環境変数関連テストと `process.env` 参照確認テストが FAIL

---

## Phase 2: GREEN（最小実装）

### Step 2-1. history-cleanup.ts の環境変数対応

**ファイル:** `apps/jobs/src/jobs/history-cleanup.ts`

変更内容:
- L2: コメント更新「保持期間を超えた変更履歴を削除」
- L12: `const HISTORY_RETENTION_DAYS = 30` → `const DEFAULT_HISTORY_RETENTION_DAYS = 30`
- 新規: `getHistoryRetentionDays()` 関数追加
  - `process.env.HISTORY_RETENTION_DAYS` を `parseInt` でパース
  - `NaN` または `<= 0` の場合、デフォルト値にフォールバック + `logger.warn`
  - 小数は `parseInt` で自動的に整数部のみ使用
- L14-17: `runHistoryCleanup()` 内で `getHistoryRetentionDays()` を呼び出し

### Step 2-2. 既存ユニットテストの安定化

**ファイル:** `apps/jobs/src/__tests__/unit/history-cleanup.test.ts`

`beforeEach` に `delete process.env.HISTORY_RETENTION_DAYS` を追加し、環境変数未設定=デフォルト30日の動作を保証。

### Step 2-3. テスト実行で GREEN を確認

```bash
docker compose exec dev pnpm --filter @agentest/jobs test -- --reporter verbose
```

**期待:** 全テスト PASS

---

## Phase 3: REFACTOR（クリーンアップ）

### Step 3-1. vitest.config.ts から削除済みファイル参照を除去

**ファイル:** `packages/shared/vitest.config.ts`

L19 `'src/config/plan-pricing.ts', // 料金テーブル定数` を削除。

### Step 3-2. batch-processing.md の環境変数テーブル更新

**ファイル:** `docs/architecture/features/batch-processing.md`

L149-153 の環境変数テーブルに `HISTORY_RETENTION_DAYS` を追加:

```markdown
| `HISTORY_RETENTION_DAYS` | No | 履歴保持日数（デフォルト: 30） |
```

### Step 3-3. dist/ クリーンビルド

```bash
docker compose exec dev pnpm --filter @agentest/shared build
```

ソース削除済みの `dist/config/plan-pricing.*` が再生成されないことを確認。

---

## 検証

```bash
# 全ユニットテスト
docker compose exec dev pnpm --filter @agentest/jobs test -- --reporter verbose

# shared パッケージテスト（vitest.config.ts 変更確認）
docker compose exec dev pnpm --filter @agentest/shared test

# 全体ビルド
docker compose exec dev pnpm build

# 全体テスト
docker compose exec dev pnpm test
```

## 成功基準

- [ ] history-cleanup が `HISTORY_RETENTION_DAYS` 環境変数に対応（デフォルト30日）
- [ ] 無効値（0以下、非数値）で警告ログ出力 + デフォルトフォールバック
- [ ] プラン制限関連コードの回帰テストが PASS
- [ ] 既存テスト（ユニット4件 + 結合4件）が全て PASS
- [ ] `pnpm build` / `pnpm test` が全体で成功
