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
| 時系列データ | 不要（初期） | プラン分布の変化は緩やかで、スナップショットで十分 |
| 基準 | Subscriptionベース | `Subscription` テーブルを正として使用 |
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
| `view` | enum | - | `combined` | `combined` / `users` / `organizations` |
| `includeTrialing` | boolean | - | `true` | トライアル中を含めるか |
| `includeMembers` | boolean | - | `true` | 組織メンバー数を含めるか |

### 2.3 レスポンス型

```typescript
interface PlanDistributionResponse {
  view: 'combined' | 'users' | 'organizations';

  users?: {
    total: number;
    byPlan: {
      free: PlanSegment;
      pro: PlanSegment;
    };
  };

  organizations?: {
    total: number;
    totalMembers: number;
    byPlan: {
      team: PlanSegment;
      enterprise: PlanSegment;
    };
  };

  combined?: {
    total: number;
    byPlan: {
      free: PlanSegment;
      pro: PlanSegment;
      team: PlanSegment;
      enterprise: PlanSegment;
    };
  };

  fetchedAt: string;
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
  "view": "combined",
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
  },
  "fetchedAt": "2026-02-01T10:00:00.000Z"
}
```

---

## 3. データベース設計

### 3.1 新規テーブル

**初期実装では不要** - 既存テーブルで対応可能

使用するテーブル:
- `users` - `plan` フィールドでグループ化
- `organizations` - `plan` フィールドでグループ化
- `subscriptions` - `plan`, `status` でフィルタ
- `organization_members` - メンバー数カウント

### 3.2 クエリ例

```sql
-- ユーザープラン分布
SELECT
  s.plan,
  COUNT(DISTINCT u.id) AS count,
  COUNT(DISTINCT CASE
    WHEN sess.last_active_at >= NOW() - INTERVAL '30 days'
    THEN u.id
  END) AS active_count
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
LEFT JOIN sessions sess ON sess.user_id = u.id
WHERE u.deleted_at IS NULL
  AND (s.status IN ('ACTIVE', 'TRIALING') OR s.id IS NULL)
GROUP BY COALESCE(s.plan, 'FREE');

-- 組織プラン分布
SELECT
  s.plan,
  COUNT(DISTINCT o.id) AS org_count,
  COUNT(DISTINCT om.user_id) AS member_count
FROM organizations o
LEFT JOIN subscriptions s ON s.organization_id = o.id
LEFT JOIN organization_members om ON om.organization_id = o.id
WHERE o.deleted_at IS NULL
  AND (s.status IN ('ACTIVE', 'TRIALING') OR s.id IS NULL)
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
├── SectionHeader（タイトル、表示モード切替、更新ボタン）
├── ChartRow
│   ├── DonutChart（ユーザープラン）
│   └── DonutChart（組織プラン）
├── SummaryCards（各プランの件数・割合サマリー）
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

### Phase 1: 基本実装

| 順序 | タスク | ファイル |
|:----:|--------|----------|
| 1 | 型定義追加 | `packages/shared/src/types/admin-metrics.ts` |
| 2 | バリデーション追加 | `packages/shared/src/validators/schemas.ts` |
| 3 | サービス実装 | `apps/api/src/services/admin/admin-metrics.service.ts` |
| 4 | コントローラー追加 | `apps/api/src/controllers/admin/metrics.controller.ts` |
| 5 | ルート追加 | `apps/api/src/routes/admin/metrics.ts` |
| 6 | DonutChartコピー | `apps/admin/src/components/ui/DonutChart.tsx` |
| 7 | フック作成 | `apps/admin/src/hooks/useAdminPlanDistribution.ts` |
| 8 | UI実装 | `apps/admin/src/pages/MetricsPage.tsx` にタブ追加 |

### Phase 2: 拡張（オプション）

- 時系列追跡用テーブル追加
- CSVエクスポート機能

---

## 7. 検証方法

### 7.1 APIテスト

```bash
# デフォルト（combined view）
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/metrics/plan-distribution"

# ユーザーのみ
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/metrics/plan-distribution?view=users"

# トライアル除外
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin/metrics/plan-distribution?includeTrialing=false"
```

### 7.2 確認ポイント

- [ ] 各プランの件数が正しい
- [ ] 割合（percentage）の合計が100%になる
- [ ] アクティブ数が30日以内のセッションを持つユーザーのみカウント
- [ ] 組織メンバー数が正しく集計される
- [ ] キャッシュが5分間有効

---

## 8. 主要ファイル

### バックエンド
- `apps/api/src/services/admin/admin-metrics.service.ts`
- `apps/api/src/controllers/admin/metrics.controller.ts`
- `apps/api/src/routes/admin/metrics.ts`

### フロントエンド
- `apps/admin/src/pages/MetricsPage.tsx`
- `apps/admin/src/components/ui/DonutChart.tsx`（新規コピー）
- `apps/admin/src/hooks/useAdminPlanDistribution.ts`（新規）

### 共有
- `packages/shared/src/types/admin-metrics.ts`
- `packages/shared/src/validators/schemas.ts`

---

## 9. 関連ドキュメント

- [システム管理者機能 実装順序](./soft-wondering-finch.md)
- [メトリクステーブル設計](../architecture/database/metrics.md)
- [管理者API仕様](../api/admin-dashboard.md)
