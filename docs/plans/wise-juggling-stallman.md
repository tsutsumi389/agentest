# 1-3. SaaS運用メトリクス削除（TDD）

## Context

AgentestのSaaS→OSS転換の一環として、SaaS運用メトリクス（DAU/WAU/MAU集計、プラン分布集計）を完全に削除する。これらはSaaS KPI追跡のための機能であり、OSSセルフホスト環境では不要。

**親プラン:** `docs/plans/jolly-crunching-pond.md` セクション1-3

---

## 変更スコープ

### 削除するファイル（8ファイル）

| ファイル | 内容 |
|---------|------|
| `apps/jobs/src/jobs/metrics-aggregation.ts` | DAU/WAU/MAU集計ジョブ |
| `apps/jobs/src/jobs/metrics-backfill.ts` | メトリクスバックフィルジョブ |
| `apps/jobs/src/lib/metrics-utils.ts` | countActiveUsers / upsertMetric |
| `apps/jobs/src/__tests__/unit/metrics-aggregation.test.ts` | 集計ジョブテスト |
| `apps/jobs/src/__tests__/unit/metrics-backfill.test.ts` | バックフィルテスト |
| `apps/admin/src/pages/MetricsPage.tsx` | 管理画面メトリクスページ（準備中stub） |
| `packages/shared/src/types/admin-metrics.ts` | メトリクス型定義 |
| `docs/architecture/database/metrics.md` | メトリクスDBドキュメント |

### 修正するファイル（7ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `apps/jobs/src/index.ts` | メトリクスジョブのimport・レジストリ削除（L7-8, L37-38） |
| `apps/admin/src/App.tsx` | MetricsPageのimport・Route削除（L4, L53） |
| `apps/admin/src/components/layout/nav-links.ts` | メトリクスnavリンク・TrendingUp import削除（L1, L20） |
| `packages/shared/src/types/index.ts` | admin-metrics re-export削除（L15） |
| `packages/shared/src/validators/schemas.ts` | activeUserMetricsQuerySchema削除（L571-602） |
| `packages/shared/src/validators/schemas.test.ts` | メトリクスクエリスキーマテスト削除（L741〜） |
| `apps/api/src/__tests__/integration/test-helpers.ts` | activeUserMetric cleanup・helper削除（L207-208, L1251-1273） |

### DBスキーマ変更（`packages/db/prisma/schema.prisma`）

- `MetricGranularity` enum 削除（L135-140）
- `ActiveUserMetric` model 削除（L1289-1300）
- マイグレーション `remove_active_user_metrics` を作成

### 削除済み（対応不要）

- `plan-distribution-aggregation.ts` — 既に削除済み
- `PlanDistributionMetric` model — スキーマから既に削除済み
- `apps/api/src/routes/admin/metrics.ts` — 既に削除済み
- `apps/api/src/services/admin-metrics.service.ts` — 既に削除済み

---

## TDD実装手順

> **方針:** 削除タスクのTDDでは、「削除されたことを検証するテスト」をREDフェーズで書き、実際の削除をGREENフェーズで行う。スキーマ変更は最後（消費側を先に除去してからPrismaクライアント再生成）。

### Step 0: ベースライン確認

```bash
docker compose exec dev pnpm build
docker compose exec dev pnpm test
```

全テスト・ビルドがパスすることを確認。

---

### Step 1: packages/shared — 型・バリデーション削除

**RED** — 削除確認テスト作成: `packages/shared/src/__tests__/metrics-removal.test.ts`
- `admin-metrics.ts` が存在しないことをアサート
- `types/index.ts` に `admin-metrics` 再エクスポートがないことをアサート
- `schemas.ts` に `activeUserMetricsQuerySchema` がないことをアサート

**GREEN** — 削除実行:
1. `packages/shared/src/types/admin-metrics.ts` を削除
2. `packages/shared/src/types/index.ts` から L15 `export * from './admin-metrics.js'` を削除
3. `packages/shared/src/types/enums.ts` から L138-139 のコメント行を削除
4. `packages/shared/src/validators/schemas.ts` から L571-602 (`activeUserMetricsQuerySchema` + 型) を削除
5. `packages/shared/src/validators/schemas.test.ts` から L32 のimportと L741〜のテストブロックを削除

**検証:** `docker compose exec dev pnpm --filter @agentest/shared test && pnpm --filter @agentest/shared build`

---

### Step 2: apps/jobs — メトリクスジョブ削除

**RED** — 削除確認テスト作成: `apps/jobs/src/__tests__/unit/metrics-removal.test.ts`
- `metrics-aggregation.ts`, `metrics-backfill.ts`, `metrics-utils.ts` が存在しないことをアサート
- `index.ts` にメトリクスジョブ参照がないことをアサート

**GREEN** — 削除実行:
1. `apps/jobs/src/jobs/metrics-aggregation.ts` を削除
2. `apps/jobs/src/jobs/metrics-backfill.ts` を削除
3. `apps/jobs/src/lib/metrics-utils.ts` を削除
4. `apps/jobs/src/__tests__/unit/metrics-aggregation.test.ts` を削除
5. `apps/jobs/src/__tests__/unit/metrics-backfill.test.ts` を削除
6. `apps/jobs/src/index.ts` から import 2行（L7-8）とレジストリ2行（L37-38）を削除

**注意:** `apps/jobs/src/lib/date-utils.ts` は汎用ユーティリティなので**残す**。

**検証:** `docker compose exec dev pnpm --filter @agentest/jobs test && pnpm --filter @agentest/jobs build`

---

### Step 3: apps/admin — メトリクスページ削除

**RED** — 削除確認テスト作成: `apps/admin/src/__tests__/metrics-removal.test.ts`
- `MetricsPage.tsx` が存在しないことをアサート
- `App.tsx` に `/metrics` ルートがないことをアサート
- `nav-links.ts` にメトリクスリンクがないことをアサート

**GREEN** — 削除実行:
1. `apps/admin/src/pages/MetricsPage.tsx` を削除
2. `apps/admin/src/App.tsx` から `MetricsPage` import（L4）と Route（L53）を削除
3. `apps/admin/src/components/layout/nav-links.ts` から:
   - L1: import から `TrendingUp` を削除
   - L20: メトリクスリンクオブジェクトを削除

**検証:** `docker compose exec dev pnpm --filter @agentest/admin build`

---

### Step 4: apps/api — テストヘルパー修正

**RED** — 削除確認テスト作成: `apps/api/src/__tests__/integration/metrics-removal.test.ts`
- `test-helpers.ts` に `activeUserMetric` / `createTestActiveUserMetric` 参照がないことをアサート

**GREEN** — 修正実行:
1. `test-helpers.ts` L207-208（コメント + `activeUserMetric.deleteMany`）を削除
2. `test-helpers.ts` L1251-1273（`createTestActiveUserMetric` 関数全体 + セクションコメント）を削除

**検証:** `docker compose exec dev pnpm --filter @agentest/api test`

---

### Step 5: DB スキーマ変更 + マイグレーション

消費側コードの削除が完了した後にスキーマを変更する。

1. `packages/db/prisma/schema.prisma` から:
   - `MetricGranularity` enum（L135-140）を削除
   - `ActiveUserMetric` model（L1284-1300 セクションコメント含む）を削除
2. Prismaクライアント再生成 + マイグレーション作成:
   ```bash
   docker compose exec dev pnpm --filter @agentest/db prisma generate
   docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name remove_active_user_metrics
   ```

**検証:** `docker compose exec dev pnpm build && pnpm test`

---

### Step 6: ドキュメント更新

1. `docs/architecture/database/metrics.md` を削除
2. `docs/architecture/database/index.md` からメトリクステーブル・enum・リンクの参照を削除
3. `docs/architecture/features/batch-processing.md` から metrics-aggregation / metrics-backfill の記述を削除
4. `docs/api/admin-dashboard.md` からメトリクスAPI セクションを削除
5. `docs/operations/batch-jobs-runbook.md` からメトリクスジョブの記述を削除
6. `docs/architecture/features/admin-system.md` からメトリクスページの記述を削除

---

## 最終検証

```bash
# 全ビルド
docker compose exec dev pnpm build

# 全テスト
docker compose exec dev pnpm test

# メトリクス参照の残存チェック（ドキュメント・マイグレーション・プラン以外）
grep -r "ActiveUserMetric\|MetricGranularity\|metrics-aggregation\|metrics-backfill\|metrics-utils\|admin-metrics" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=migrations \
  apps/ packages/

# Prismaスキーマ整合性
docker compose exec dev pnpm --filter @agentest/db prisma validate
```

期待結果: ビルド・テスト全パス、grep結果ゼロ。
