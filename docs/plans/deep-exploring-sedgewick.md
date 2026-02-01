# ADM-MON-003: バッチジョブ移植と仕様ドキュメント更新

## 概要

プラン別ユーザー分布機能（ADM-MON-003）は既に実装完了済み。
残作業として、バッチジョブを `apps/jobs/` に Cloud Run Jobs 形式で移植し、仕様ドキュメントを更新する。

---

## 現状

| コンポーネント | 状態 | ファイル |
|--------------|:----:|---------|
| Prismaスキーマ | ✅ | `packages/db/prisma/schema.prisma` |
| 型定義 | ✅ | `packages/shared/src/types/admin-metrics.ts` |
| バリデーション | ✅ | `packages/shared/src/validators/schemas.ts` |
| サービス | ✅ | `apps/api/src/services/admin/admin-metrics.service.ts` |
| コントローラー | ✅ | `apps/api/src/controllers/admin/metrics.controller.ts` |
| ルート | ✅ | `apps/api/src/routes/admin/metrics.ts` |
| フロントエンド | ✅ | `apps/admin/src/pages/MetricsPage.tsx` |
| DonutChart | ✅ | `apps/admin/src/components/ui/DonutChart.tsx` |
| Hook | ✅ | `apps/admin/src/hooks/useAdminPlanDistribution.ts` |
| バッチジョブ（旧） | ⚠️ | `apps/api/src/jobs/aggregate-plan-distribution.ts` |
| バッチジョブ（新） | ❌ | `apps/jobs/src/jobs/plan-distribution-aggregation.ts` |

---

## 実装タスク

### Task 1: Cloud Run Jobs 形式でバッチジョブを作成

**ファイル**: `apps/jobs/src/jobs/plan-distribution-aggregation.ts`（新規作成）

既存の `apps/api/src/jobs/aggregate-plan-distribution.ts` のロジックを移植し、`metrics-aggregation.ts` と同じパターンで実装する。

```typescript
// エクスポート関数
export async function runPlanDistributionAggregation(): Promise<void>
```

**集計タイミング**（metrics-aggregation.ts と統一）:
- DAY: 毎日、前日分を集計
- WEEK: 月曜日に前週分を集計
- MONTH: 月初に前月分を集計

### Task 2: index.ts にジョブを登録

**ファイル**: `apps/jobs/src/index.ts`

```typescript
import { runPlanDistributionAggregation } from './jobs/plan-distribution-aggregation.js';

const jobs: Record<string, () => Promise<void>> = {
  // ... 既存ジョブ
  'plan-distribution-aggregation': runPlanDistributionAggregation,
};
```

### Task 3: 旧ジョブファイルを削除

**ファイル**: `apps/api/src/jobs/aggregate-plan-distribution.ts`（削除）

- APIサーバーで使用されていないことを確認済み
- 新ジョブに移植後、削除する

### Task 4: 仕様ドキュメントを更新

**ファイル**: `docs/plans/silly-yawning-turing.md`

更新内容:
1. セクション3.2「バッチジョブ」にCloud Run Jobs形式の説明を追加
2. セクション6「実装計画」に各タスクの完了ステータスを追加
3. セクション8「主要ファイル」のバッチジョブパスを更新

---

## 実装詳細

### plan-distribution-aggregation.ts の設計

```typescript
import { prisma } from '../lib/prisma.js';
import type { MetricGranularity } from '@agentest/db';
import {
  getJSTYesterdayStart,
  getJSTDayOfWeek,
  getJSTDayOfMonth,
  getJSTLastMonday,
  getJSTLastMonthStart,
  formatDateStringJST,
} from '../lib/date-utils.js';

// メイン関数
export async function runPlanDistributionAggregation(): Promise<void> {
  const now = new Date();
  console.log(`プラン分布集計開始: ${now.toISOString()}`);

  // 前日のDAY集計
  await aggregateDAY(now);

  // 月曜（getJSTDayOfWeek === 1）の場合、前週のWEEK集計
  if (getJSTDayOfWeek(now) === 1) {
    await aggregateWEEK(now);
  }

  // 月初（getJSTDayOfMonth === 1）の場合、前月のMONTH集計
  if (getJSTDayOfMonth(now) === 1) {
    await aggregateMONTH(now);
  }

  console.log('プラン分布集計完了');
}
```

**集計ロジック**（既存ロジックを流用）:
- ユーザープラン: FREE（サブスクなし or FREEプラン）/ PRO
- 組織プラン: TEAM（サブスクなし or TEAMプラン）/ ENTERPRISE
- メンバー数: 各プランの組織に所属するメンバー数

---

## 検証方法

### 1. ジョブの実行テスト

```bash
# Docker環境で実行
docker compose exec dev sh -c "cd apps/jobs && JOB_NAME=plan-distribution-aggregation pnpm start"
```

### 2. データベース確認

```bash
docker compose exec postgres psql -U agentest -d agentest -c \
  "SELECT granularity, period_start, free_user_count, pro_user_count, team_org_count, enterprise_org_count FROM plan_distribution_metrics ORDER BY period_start DESC LIMIT 5;"
```

### 3. API確認

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/metrics/plan-distribution"
```

### 確認ポイント

- [ ] ジョブが正常に起動・終了する
- [ ] DAY粒度のレコードが作成される
- [ ] 月曜日に実行した場合、WEEK粒度も作成される
- [ ] 月初に実行した場合、MONTH粒度も作成される
- [ ] upsertで既存データの上書きが正しく動作する

---

## 対象ファイル一覧

| 操作 | ファイル |
|:----:|---------|
| 新規作成 | `apps/jobs/src/jobs/plan-distribution-aggregation.ts` |
| 編集 | `apps/jobs/src/index.ts` |
| 削除 | `apps/api/src/jobs/aggregate-plan-distribution.ts` |
| 編集 | `docs/plans/silly-yawning-turing.md` |
