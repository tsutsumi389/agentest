# ADM-MON-002: アクティブユーザー推移 詳細仕様

## 概要

管理者ダッシュボードにDAU（日次アクティブユーザー）/WAU（週次）/MAU（月次）の時系列推移グラフを表示する機能。

**ID**: ADM-MON-002
**権限**: ALL（SUPER_ADMIN, ADMIN, VIEWER）
**依存**: ADM-MON-001（システムダッシュボード）

### 決定事項
- **対象範囲**: ユーザー推移のみ（組織推移は将来拡張）
- **グラフ実装**: SVGベース自前実装（外部ライブラリ不使用）

---

## 1. メトリクス定義

### アクティブユーザーの定義

| メトリクス | 定義 | 集計単位 |
|-----------|------|---------|
| **DAU** | 該当日に `Session.lastActiveAt` が更新されたユニークユーザー数 | 日単位 |
| **WAU** | 該当週に `Session.lastActiveAt` が更新されたユニークユーザー数 | 週単位（月曜起点） |
| **MAU** | 該当月に `Session.lastActiveAt` が更新されたユニークユーザー数 | 月単位 |

**判定条件**:
- `Session.revokedAt` が `NULL`
- `Session.lastActiveAt` が対象期間内
- `User.deletedAt` が `NULL`

---

## 2. データストレージ設計

### 方式: 粒度別集計テーブル（DAU/WAU/MAU）

**理由**:
- DAUのみだとWAU/MAUのユニークユーザー数を正確に計算できない
- 各粒度で事前集計することで高速かつ正確なデータを提供
- 過去データは不変のため、キャッシュと組み合わせて最適化

### Prismaスキーマ追加

```prisma
// packages/db/prisma/schema.prisma

// アクティブユーザー集計の粒度
enum MetricGranularity {
  DAY
  WEEK
  MONTH
}

// アクティブユーザーメトリクス（共通テーブル）
model ActiveUserMetric {
  id          String            @id @default(uuid())
  granularity MetricGranularity
  periodStart DateTime          @map("period_start") @db.Date  // 期間開始日
  userCount   Int               @map("user_count")
  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  @@unique([granularity, periodStart])
  @@index([granularity, periodStart])
  @@map("active_user_metrics")
}
```

### データ例

| granularity | periodStart | userCount | 説明 |
|-------------|-------------|-----------|------|
| DAY | 2026-01-15 | 150 | 1/15のDAU |
| WEEK | 2026-01-13 | 420 | 1/13週（月曜）のWAU |
| MONTH | 2026-01-01 | 980 | 1月のMAU |

---

## 3. API設計

### エンドポイント

```
GET /admin/metrics/active-users
```

### クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|-----|-----------|------|
| `granularity` | enum | - | `day` | 粒度: `day`, `week`, `month` |
| `startDate` | string | - | 30日前 | 開始日 (ISO 8601) |
| `endDate` | string | - | 本日 | 終了日 (ISO 8601) |
| `timezone` | string | - | `Asia/Tokyo` | タイムゾーン |

### レスポンス形式

```typescript
interface ActiveUserMetricsResponse {
  granularity: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;
  timezone: string;
  data: Array<{
    date: string;   // "2026-01-15"
    count: number;  // 150
  }>;
  summary: {
    average: number;      // 期間内平均
    max: number;          // 最大値
    min: number;          // 最小値
    changeRate: number | null;  // 前期間比（%）
  };
  fetchedAt: string;
}
```

### レスポンス例

```json
{
  "granularity": "day",
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-01-31T23:59:59.999Z",
  "timezone": "Asia/Tokyo",
  "data": [
    { "date": "2026-01-01", "count": 150 },
    { "date": "2026-01-02", "count": 142 },
    { "date": "2026-01-03", "count": 98 }
  ],
  "summary": {
    "average": 130,
    "max": 150,
    "min": 98,
    "changeRate": 5.2
  },
  "fetchedAt": "2026-02-01T10:00:00.000Z"
}
```

---

## 4. バリデーション

```typescript
// packages/shared/src/validators/schemas.ts

export const activeUserMetricsQuerySchema = z.object({
  granularity: z.enum(['day', 'week', 'month']).default('day'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timezone: z.string().default('Asia/Tokyo'),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'startDateはendDate以前の日付を指定してください' }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      const diffDays = (new Date(data.endDate).getTime() -
                        new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 365;
    }
    return true;
  },
  { message: '期間は最大365日までです' }
);
```

---

## 5. キャッシュ戦略

| データ種別 | TTL | 理由 |
|-----------|-----|------|
| 過去データ（集計済み） | 5分 | 変更されないが、クエリバリエーション考慮 |
| 当日データ込み | 1分 | リアルタイム性を重視 |

---

## 6. 実装ファイル構成

### 新規作成

| ファイル | 役割 |
|---------|------|
| `packages/shared/src/types/admin-metrics.ts` | 型定義 |
| `apps/api/src/services/admin/admin-metrics.service.ts` | メトリクス取得サービス |
| `apps/api/src/controllers/admin/metrics.controller.ts` | コントローラー |
| `apps/api/src/routes/admin/metrics.ts` | ルーター |
| `apps/jobs/src/jobs/metrics-aggregation.ts` | 日次集計ジョブ |
| `apps/admin/src/components/ui/LineChart.tsx` | 折れ線グラフ |
| `apps/admin/src/pages/MetricsPage.tsx` | メトリクス画面 |

### 修正

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | ActiveUserMetric テーブル + MetricGranularity enum 追加 |
| `apps/api/src/lib/redis-store.ts` | メトリクスキャッシュ関数追加 |
| `apps/api/src/routes/admin/index.ts` | メトリクスルーター追加 |
| `packages/shared/src/validators/schemas.ts` | バリデーションスキーマ追加 |
| `apps/jobs/src/index.ts` | metrics-aggregation ジョブ登録 |

---

## 7. 集計ジョブ（apps/jobs）

### ジョブ設計

```typescript
// apps/jobs/src/jobs/metrics-aggregation.ts

/**
 * メトリクス集計ジョブ
 * DAU/WAU/MAUを集計してテーブルに保存
 * 毎日 1:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';

export async function runMetricsAggregation(): Promise<void> {
  const now = new Date();

  // 前日のDAU集計
  await aggregateDAU(now);

  // 週初（月曜）の場合、前週のWAU集計
  if (now.getDay() === 1) {
    await aggregateWAU(now);
  }

  // 月初の場合、前月のMAU集計
  if (now.getDate() === 1) {
    await aggregateMAU(now);
  }
}

/**
 * DAU（日次アクティブユーザー）集計
 */
async function aggregateDAU(now: Date): Promise<void> {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date(yesterday);
  today.setDate(today.getDate() + 1);

  const count = await prisma.user.count({
    where: {
      deletedAt: null,
      sessions: {
        some: {
          lastActiveAt: { gte: yesterday, lt: today },
          revokedAt: null,
        },
      },
    },
  });

  await prisma.activeUserMetric.upsert({
    where: {
      granularity_periodStart: {
        granularity: 'DAY',
        periodStart: yesterday,
      },
    },
    create: { granularity: 'DAY', periodStart: yesterday, userCount: count },
    update: { userCount: count },
  });

  console.log(`DAU ${yesterday.toISOString().split('T')[0]}: ${count}`);
}

/**
 * WAU（週次アクティブユーザー）集計
 */
async function aggregateWAU(now: Date): Promise<void> {
  // 前週の月曜日を計算
  const lastMonday = new Date(now);
  lastMonday.setDate(lastMonday.getDate() - 7);
  lastMonday.setHours(0, 0, 0, 0);

  const thisMonday = new Date(lastMonday);
  thisMonday.setDate(thisMonday.getDate() + 7);

  const count = await prisma.user.count({
    where: {
      deletedAt: null,
      sessions: {
        some: {
          lastActiveAt: { gte: lastMonday, lt: thisMonday },
          revokedAt: null,
        },
      },
    },
  });

  await prisma.activeUserMetric.upsert({
    where: {
      granularity_periodStart: {
        granularity: 'WEEK',
        periodStart: lastMonday,
      },
    },
    create: { granularity: 'WEEK', periodStart: lastMonday, userCount: count },
    update: { userCount: count },
  });

  console.log(`WAU ${lastMonday.toISOString().split('T')[0]}: ${count}`);
}

/**
 * MAU（月次アクティブユーザー）集計
 */
async function aggregateMAU(now: Date): Promise<void> {
  // 前月の1日を計算
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const count = await prisma.user.count({
    where: {
      deletedAt: null,
      sessions: {
        some: {
          lastActiveAt: { gte: lastMonthStart, lt: thisMonthStart },
          revokedAt: null,
        },
      },
    },
  });

  await prisma.activeUserMetric.upsert({
    where: {
      granularity_periodStart: {
        granularity: 'MONTH',
        periodStart: lastMonthStart,
      },
    },
    create: { granularity: 'MONTH', periodStart: lastMonthStart, userCount: count },
    update: { userCount: count },
  });

  console.log(`MAU ${lastMonthStart.toISOString().split('T')[0]}: ${count}`);
}
```

### index.tsへの登録

```typescript
// apps/jobs/src/index.ts に追加

import { runMetricsAggregation } from './jobs/metrics-aggregation.js';

const jobs: Record<string, () => Promise<void>> = {
  // ... 既存のジョブ
  'metrics-aggregation': runMetricsAggregation,
};
```

### 実行方法

```bash
# Docker経由で実行
docker compose exec jobs pnpm start
# または
JOB_NAME=metrics-aggregation docker compose exec jobs pnpm start
```

---

## 8. フロントエンド設計

### 期間選択プリセット

```typescript
const DATE_PRESETS = [
  { label: '過去7日', days: 7 },
  { label: '過去30日', days: 30 },
  { label: '過去90日', days: 90 },
  { label: '今月', type: 'thisMonth' },
  { label: '先月', type: 'lastMonth' },
  { label: 'カスタム', type: 'custom' },
];
```

### LineChartコンポーネント

- SVGベースの軽量実装（外部ライブラリ不使用）
- 既存の `DonutChart.tsx` を参考

---

## 9. テスト計画

### 単体テスト

```typescript
describe('AdminMetricsService', () => {
  it('日次粒度でデータを取得できる');
  it('週次粒度で正しく集計される');
  it('月次粒度で正しく集計される');
  it('キャッシュがある場合はキャッシュを返す');
  it('当日データはリアルタイムで取得される');
  it('サマリーが正しく計算される');
});
```

### 統合テスト

```typescript
describe('GET /admin/metrics/active-users', () => {
  it('認証済み管理者はアクセスできる');
  it('未認証の場合は401を返す');
  it('パラメータバリデーションが正しく動作する');
  it('期間超過時は400を返す');
});
```

---

## 10. 実装順序

### Phase 1: バックエンド基盤
1. Prismaスキーマ追加（MetricGranularity enum + ActiveUserMetric）
2. マイグレーション実行
3. 型定義追加（admin-metrics.ts）
4. バリデーションスキーマ追加

### Phase 2: サービス層
1. AdminMetricsService 実装
2. Redisキャッシュ関数追加
3. 単体テスト作成

### Phase 3: API層
1. コントローラー実装
2. ルーター実装・登録
3. 統合テスト作成

### Phase 4: 集計バッチ（apps/jobs）
1. `apps/jobs/src/jobs/metrics-aggregation.ts` に日次集計ジョブ実装
2. `apps/jobs/src/index.ts` にジョブ登録
3. 過去データ投入スクリプト作成
4. 単体テスト作成

### Phase 5: フロントエンド
1. LineChartコンポーネント作成
2. MetricsPage実装
3. 期間選択UI実装

---

## 11. 検証方法

1. `docker compose exec dev pnpm test` でテスト実行
2. 管理者としてログインし `/admin/metrics` にアクセス
3. 期間選択・粒度切り替えでグラフ表示を確認
4. キャッシュ動作をRedis CLIで確認

---

## 12. 関連ファイル（参照用）

- `apps/api/src/services/admin/admin-dashboard.service.ts` - 既存パターン
- `packages/shared/src/types/admin-dashboard.ts` - 型定義パターン
- `apps/api/src/lib/redis-store.ts` - キャッシュ実装
- `apps/admin/src/components/ui/DonutChart.tsx` - チャート参考
- `apps/jobs/src/jobs/history-cleanup.ts` - ジョブ実装パターン
- `apps/jobs/src/index.ts` - ジョブ登録パターン
