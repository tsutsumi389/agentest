# ADM-MON-003: プラン別ユーザー分布 詳細仕様

## 概要

システム管理者ダッシュボードに表示する「プラン別ユーザー分布」機能の詳細仕様。
既存のアクティブユーザー推移（ADM-MON-002）と同じ実装パターンに従う。

**UI配置**: 既存の MetricsPage にタブとして追加

---

## 1. 機能要件

### 1.1 表示内容

| 分類 | 内容 |
|------|------|
| ユーザープラン分布 | FREE / PRO の現在の分布（件数、割合、アクティブ数） |
| 組織プラン分布 | TEAM / ENTERPRISE の現在の分布（件数、割合、メンバー数） |
| 統合ビュー | 全プラン（FREE/PRO/TEAM/ENTERPRISE）の統合表示 |

※収益インパクト（MRR/ARR）は初期実装ではスコープ外

### 1.2 設計判断

| 項目 | 判断 | 理由 |
|------|------|------|
| 時系列データ | **必要** | 日別・月別でプランの推移を追跡できるようにする |
| 基準 | Subscriptionベース | `Subscription` テーブルを正として使用（トライアル機能なし） |
| 組織メンバー数 | 考慮する | 「影響ユーザー数」として算出 |

---

## 2. API仕様

### 2.1 エンドポイント

```
GET /admin/metrics/plan-distribution
```

### 2.2 クエリパラメータ

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|-----|-----------|------|
| `granularity` | enum | - | `day` | `day` / `week` / `month` |
| `startDate` | datetime | - | 30日前 | 期間開始日（ISO 8601） |
| `endDate` | datetime | - | 今日 | 期間終了日（ISO 8601） |
| `timezone` | string | - | `Asia/Tokyo` | タイムゾーン |
| `view` | enum | - | `combined` | `combined` / `users` / `organizations` |
| `includeMembers` | boolean | - | `true` | 組織メンバー数を含めるか |

※アクティブユーザー推移と同じパターンで時系列データを返す

### 2.3 レスポンス型

```typescript
interface PlanDistributionResponse {
  // クエリ情報
  granularity: 'day' | 'week' | 'month';
  startDate: string;    // ISO 8601
  endDate: string;      // ISO 8601
  timezone: string;
  view: 'combined' | 'users' | 'organizations';

  // 時系列データ
  data: PlanDistributionDataPoint[];

  // 最新時点のサマリー
  current: {
    users?: {
      total: number;
      byPlan: { free: PlanSegment; pro: PlanSegment };
    };
    organizations?: {
      total: number;
      totalMembers: number;
      byPlan: { team: PlanSegment; enterprise: PlanSegment };
    };
    combined?: {
      total: number;
      byPlan: { free: PlanSegment; pro: PlanSegment; team: PlanSegment; enterprise: PlanSegment };
    };
  };

  fetchedAt: string;
}

// 時系列データポイント
interface PlanDistributionDataPoint {
  date: string;  // YYYY-MM-DD
  users?: {
    free: number;
    pro: number;
  };
  organizations?: {
    team: number;
    enterprise: number;
    teamMembers: number;
    enterpriseMembers: number;
  };
}

interface PlanSegment {
  count: number;
  percentage: number;
  members?: number;      // 組織プランの場合のみ
  activeCount?: number;  // 30日以内にアクティブなユーザー数
}
```

### 2.4 レスポンス例

```json
{
  "granularity": "day",
  "startDate": "2026-01-02",
  "endDate": "2026-02-01",
  "timezone": "Asia/Tokyo",
  "view": "combined",
  "data": [
    {
      "date": "2026-01-02",
      "users": { "free": 980, "pro": 220 },
      "organizations": { "team": 65, "enterprise": 17, "teamMembers": 260, "enterpriseMembers": 160 }
    },
    {
      "date": "2026-01-03",
      "users": { "free": 985, "pro": 222 },
      "organizations": { "team": 66, "enterprise": 17, "teamMembers": 264, "enterpriseMembers": 162 }
    },
    "... (省略)"
  ],
  "current": {
    "users": {
      "total": 1234,
      "byPlan": {
        "free": { "count": 1000, "percentage": 81.0, "activeCount": 350 },
        "pro": { "count": 234, "percentage": 19.0, "activeCount": 180 }
      }
    },
    "organizations": {
      "total": 89,
      "totalMembers": 456,
      "byPlan": {
        "team": { "count": 70, "percentage": 78.7, "members": 280, "activeCount": 42 },
        "enterprise": { "count": 19, "percentage": 21.3, "members": 176, "activeCount": 15 }
      }
    },
    "combined": {
      "total": 1690,
      "byPlan": {
        "free": { "count": 1000, "percentage": 59.2 },
        "pro": { "count": 234, "percentage": 13.8 },
        "team": { "count": 280, "percentage": 16.6 },
        "enterprise": { "count": 176, "percentage": 10.4 }
      }
    }
  },
  "fetchedAt": "2026-02-01T10:00:00.000Z"
}
```

---

## 3. データベース設計

### 3.1 新規テーブル（必須）

時系列追跡のため、集計テーブルを追加（ActiveUserMetricと同様のパターン）

```prisma
// プラン分布メトリクス（日次/週次/月次の集計データ）
model PlanDistributionMetric {
  id          String            @id @default(uuid())
  granularity MetricGranularity // DAY, WEEK, MONTH
  periodStart DateTime          @map("period_start") @db.Date

  // ユーザープラン
  freeUserCount Int @default(0) @map("free_user_count")
  proUserCount  Int @default(0) @map("pro_user_count")

  // 組織プラン
  teamOrgCount          Int @default(0) @map("team_org_count")
  teamMemberCount       Int @default(0) @map("team_member_count")
  enterpriseOrgCount    Int @default(0) @map("enterprise_org_count")
  enterpriseMemberCount Int @default(0) @map("enterprise_member_count")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([granularity, periodStart])
  @@index([granularity, periodStart])
  @@map("plan_distribution_metrics")
}
```

### 3.2 バッチジョブ（Cloud Run Jobs形式）

日次でプラン分布を集計し、テーブルに保存。`apps/jobs/` 配下でCloud Run Jobs形式として実装。

**実行方法**:
```bash
# Docker環境で実行
docker compose exec dev sh -c "cd apps/jobs && JOB_NAME=plan-distribution-aggregation pnpm start"
```

**集計タイミング**（metrics-aggregation.ts と統一）:
- **DAY**: 毎日、前日分を集計
- **WEEK**: 月曜日に前週分を集計
- **MONTH**: 月初に前月分を集計

```typescript
// apps/jobs/src/jobs/plan-distribution-aggregation.ts
export async function runPlanDistributionAggregation(): Promise<void> {
  // 1. 前日のDAY粒度を集計
  // 2. 月曜日の場合、前週のWEEK粒度も集計
  // 3. 月初の場合、前月のMONTH粒度も集計
}
```

### 3.3 現在のスナップショット取得クエリ

```sql
-- ユーザープラン分布（現在）
SELECT
  COALESCE(s.plan, 'FREE') AS plan,
  COUNT(DISTINCT u.id) AS count,
  COUNT(DISTINCT CASE
    WHEN sess.last_active_at >= NOW() - INTERVAL '30 days'
    THEN u.id
  END) AS active_count
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
LEFT JOIN sessions sess ON sess.user_id = u.id
WHERE u.deleted_at IS NULL
  AND (s.status = 'ACTIVE' OR s.id IS NULL)
GROUP BY COALESCE(s.plan, 'FREE');

-- 組織プラン分布（現在）
SELECT
  COALESCE(s.plan, 'TEAM') AS plan,
  COUNT(DISTINCT o.id) AS org_count,
  COUNT(DISTINCT om.user_id) AS member_count
FROM organizations o
LEFT JOIN subscriptions s ON s.organization_id = o.id
LEFT JOIN organization_members om ON om.organization_id = o.id
WHERE o.deleted_at IS NULL
  AND (s.status = 'ACTIVE' OR s.id IS NULL)
GROUP BY COALESCE(s.plan, 'TEAM');
```

---

## 4. UI設計

### 4.1 ページ構成

既存の MetricsPage (`/admin/metrics`) に「プラン分布」タブを追加

```
MetricsPage
├── TabBar
│   ├── [アクティブユーザー] ← 既存
│   └── [プラン分布] ← 新規追加
└── TabContent
    ├── ActiveUsersSection（既存）
    └── PlanDistributionSection（新規）
```

### 4.2 コンポーネント構成

```
PlanDistributionSection
├── ControlBar
│   ├── GranularitySelector（日次 / 週次 / 月次）
│   ├── PeriodPresets（過去7日 / 30日 / 90日 / 当月 / 先月）
│   └── RefreshButton
├── TimeSeriesChart（時系列推移）
│   └── LineChart（既存コンポーネントを再利用）
├── CurrentDistribution（現在の分布）
│   ├── DonutChart（ユーザープラン: FREE/PRO）
│   └── DonutChart（組織プラン: TEAM/ENTERPRISE）
├── SummaryCards（各プランの件数・割合）
└── DetailTable（プラン別詳細）
```

### 4.3 カラースキーム

```typescript
const PLAN_COLORS = {
  free: '#6e7681',       // グレー
  pro: '#58a6ff',        // ブルー
  team: '#3fb950',       // グリーン
  enterprise: '#a371f7', // パープル
};
```

### 4.4 DonutChartコンポーネント

既存の `/apps/web/src/components/ui/DonutChart.tsx` を admin アプリにコピーして使用

---

## 5. キャッシュ戦略

| 設定 | 値 |
|------|-----|
| TTL | 5分（300秒） |
| キャッシュキー | `admin:metrics:plan-distribution:${hash(params)}` |
| 無効化条件 | サブスクリプション変更時 |

---

## 6. 実装計画

### Phase 1: データベース・バックエンド

| 順序 | タスク | ファイル | 状態 |
|:----:|--------|----------|:----:|
| 1 | Prismaスキーマ追加 | `packages/db/prisma/schema.prisma` | ✅ |
| 2 | マイグレーション実行 | `pnpm db:migrate` | ✅ |
| 3 | 型定義追加 | `packages/shared/src/types/admin-metrics.ts` | ✅ |
| 4 | バリデーション追加 | `packages/shared/src/validators/schemas.ts` | ✅ |
| 5 | サービス実装 | `apps/api/src/services/admin/admin-metrics.service.ts` | ✅ |
| 6 | コントローラー追加 | `apps/api/src/controllers/admin/metrics.controller.ts` | ✅ |
| 7 | ルート追加 | `apps/api/src/routes/admin/metrics.ts` | ✅ |
| 8 | バッチジョブ追加 | `apps/jobs/src/jobs/plan-distribution-aggregation.ts` | ✅ |

### Phase 2: フロントエンド

| 順序 | タスク | ファイル | 状態 |
|:----:|--------|----------|:----:|
| 9 | DonutChartコピー | `apps/admin/src/components/ui/DonutChart.tsx` | ✅ |
| 10 | フック作成 | `apps/admin/src/hooks/useAdminPlanDistribution.ts` | ✅ |
| 11 | UI実装 | `apps/admin/src/pages/MetricsPage.tsx` にタブ追加 | ✅ |

### Phase 3: 拡張（オプション）

- CSVエクスポート機能

---

## 7. 検証方法

### 7.1 APIテスト

```bash
# デフォルト（日次、過去30日、combined view）
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/metrics/plan-distribution"

# 月次データ
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/metrics/plan-distribution?granularity=month&startDate=2025-01-01"

# ユーザーのみ
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/metrics/plan-distribution?view=users"

# 組織のみ
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/metrics/plan-distribution?view=organizations"
```

### 7.2 確認ポイント

- [ ] 時系列データ（data配列）が正しく返される
- [ ] 各プランの件数が正しい
- [ ] 割合（percentage）の合計が100%になる
- [ ] アクティブ数が30日以内のセッションを持つユーザーのみカウント
- [ ] 組織メンバー数が正しく集計される
- [ ] granularity（day/week/month）で正しく集計される
- [ ] キャッシュが5分間有効

---

## 8. 主要ファイル

### データベース
- `packages/db/prisma/schema.prisma` - PlanDistributionMetric テーブル追加

### バックエンド
- `apps/api/src/services/admin/admin-metrics.service.ts`
- `apps/api/src/controllers/admin/metrics.controller.ts`
- `apps/api/src/routes/admin/metrics.ts`

### バッチジョブ（Cloud Run Jobs形式）
- `apps/jobs/src/jobs/plan-distribution-aggregation.ts` - プラン分布集計ジョブ
- `apps/jobs/src/index.ts` - ジョブ登録

### フロントエンド
- `apps/admin/src/pages/MetricsPage.tsx`
- `apps/admin/src/components/ui/DonutChart.tsx`
- `apps/admin/src/hooks/useAdminPlanDistribution.ts`

### 共有
- `packages/shared/src/types/admin-metrics.ts`
- `packages/shared/src/validators/schemas.ts`

---

## 9. 関連ドキュメント

- [システム管理者機能 実装順序](./soft-wondering-finch.md)
- [メトリクステーブル設計](../architecture/database/metrics.md)
- [管理者API仕様](../api/admin-dashboard.md)
