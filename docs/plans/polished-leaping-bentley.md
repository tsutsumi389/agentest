# システムダッシュボード（ADM-MON-001）詳細実装計画

## 概要

管理者向けシステムダッシュボードを実装する。プラットフォーム全体の統計情報（ユーザー数、組織数、テスト実行数、収益、システムヘルス）をリアルタイムで表示する。

**権限**: ALL（SUPER_ADMIN, ADMIN, VIEWER）

---

## 1. APIエンドポイント設計

### エンドポイント
```
GET /admin/dashboard
Authorization: Cookie (admin-session)
```

### レスポンス型

```typescript
interface AdminDashboardStats {
  users: {
    total: number;                    // 総ユーザー数
    byPlan: { free: number; pro: number };  // プラン分布
    newThisMonth: number;             // 当月新規
    activeUsers: number;              // アクティブ（30日）
  };
  organizations: {
    total: number;
    byPlan: { team: number; enterprise: number };
    newThisMonth: number;
    activeOrgs: number;
  };
  executions: {
    totalThisMonth: number;           // 当月実行数
    passCount: number;
    failCount: number;
    passRate: number;                 // 成功率（%）
  };
  revenue: {
    mrr: number;                      // 月間経常収益（円）
    invoices: { paid: number; pending: number; failed: number };
  };
  systemHealth: {
    api: SystemHealthStatus;
    database: SystemHealthStatus;
    redis: SystemHealthStatus;
    minio: SystemHealthStatus;
  };
  fetchedAt: string;
}

interface SystemHealthStatus {
  status: 'healthy' | 'unhealthy' | 'not_configured';
  latency?: number;
  error?: string;
}
```

---

## 2. 実装ファイル一覧

### 新規作成

| ファイル | 内容 |
|---------|------|
| `packages/shared/src/types/admin-dashboard.ts` | 型定義 |
| `apps/api/src/services/admin/admin-dashboard.service.ts` | ダッシュボードサービス |
| `apps/api/src/controllers/admin/dashboard.controller.ts` | コントローラー |
| `apps/api/src/routes/admin/dashboard.ts` | ルーター |
| `apps/admin/src/hooks/useAdminDashboard.ts` | データ取得フック |
| `apps/admin/src/components/dashboard/SystemHealthCard.tsx` | ヘルスカード |
| `apps/admin/src/components/dashboard/UserStatsCard.tsx` | ユーザー統計 |
| `apps/admin/src/components/dashboard/OrgStatsCard.tsx` | 組織統計 |
| `apps/admin/src/components/dashboard/ExecutionStatsCard.tsx` | 実行統計 |
| `apps/admin/src/components/dashboard/RevenueStatsCard.tsx` | 収益指標 |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/src/types/index.ts` | エクスポート追加 |
| `apps/api/src/lib/redis-store.ts` | キャッシュ関数追加 |
| `apps/api/src/routes/admin/index.ts` | ルーター登録 |
| `apps/admin/src/lib/api.ts` | API追加 |
| `apps/admin/src/pages/Dashboard.tsx` | コンポーネント構成変更 |

---

## 3. サービス層設計

`AdminDashboardService` は ProjectDashboardService パターンを踏襲:

```typescript
class AdminDashboardService {
  // メイン: 全統計を並列取得、キャッシュ対応
  async getDashboard(): Promise<AdminDashboardStats>

  // 個別統計（Promise.all で並列実行）
  private async getUserStats(): Promise<AdminDashboardUserStats>
  private async getOrgStats(): Promise<AdminDashboardOrgStats>
  private async getExecutionStats(): Promise<AdminDashboardExecutionStats>
  private async getRevenueStats(): Promise<AdminDashboardRevenueStats>
  private async getSystemHealth(): Promise<AdminDashboardSystemHealth>

  // キャッシュ（Redis, TTL: 5分）
  private async getCachedDashboard(): Promise<AdminDashboardStats | null>
  private async cacheDashboard(stats: AdminDashboardStats): Promise<void>
}
```

### 集計クエリ例

```typescript
// ユーザー統計
const [total, freeCount, proCount, newThisMonth, activeUsers] = await Promise.all([
  prisma.user.count({ where: { deletedAt: null } }),
  prisma.user.count({ where: { plan: 'FREE', deletedAt: null } }),
  prisma.user.count({ where: { plan: 'PRO', deletedAt: null } }),
  prisma.user.count({ where: { createdAt: { gte: startOfMonth }, deletedAt: null } }),
  prisma.user.count({
    where: { deletedAt: null, sessions: { some: { lastActiveAt: { gte: thirtyDaysAgo } } } },
  }),
]);

// テスト実行統計
const resultCounts = await prisma.executionExpectedResult.groupBy({
  by: ['status'],
  where: { execution: { createdAt: { gte: startOfMonth } } },
  _count: { status: true },
});
```

---

## 4. フロントエンド設計

### コンポーネント構成

```
Dashboard.tsx
├── SystemHealthCard     # 4サービスのヘルス状態
├── Grid (2x2)
│   ├── UserStatsCard    # ユーザー数、プラン分布
│   ├── OrgStatsCard     # 組織数、プラン分布
│   ├── ExecutionStatsCard # 実行数、成功率
│   └── RevenueStatsCard # MRR、請求書状況
└── 最終更新時刻
```

### データ取得

```typescript
// useAdminDashboard.ts
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminDashboardApi.getStats(),
    staleTime: 5 * 60 * 1000,      // 5分
    refetchInterval: 5 * 60 * 1000, // 5分ごと自動更新
  });
}
```

---

## 5. 実装順序

### Phase 1: 型定義
1. `packages/shared/src/types/admin-dashboard.ts` 作成
2. `packages/shared/src/types/index.ts` にエクスポート追加

### Phase 2: バックエンド
3. `apps/api/src/lib/redis-store.ts` にキャッシュ関数追加
4. `apps/api/src/services/admin/admin-dashboard.service.ts` 作成
5. `apps/api/src/controllers/admin/dashboard.controller.ts` 作成
6. `apps/api/src/routes/admin/dashboard.ts` 作成
7. `apps/api/src/routes/admin/index.ts` にルーター登録

### Phase 3: フロントエンド
8. `apps/admin/src/lib/api.ts` に adminDashboardApi 追加
9. `apps/admin/src/hooks/useAdminDashboard.ts` 作成
10. `apps/admin/src/components/dashboard/*.tsx` 5コンポーネント作成
11. `apps/admin/src/pages/Dashboard.tsx` 更新

### Phase 4: テスト
12. サービスユニットテスト作成
13. 統合テスト作成

---

## 6. 参照ファイル

| ファイル | 参照ポイント |
|---------|-------------|
| `apps/api/src/services/project-dashboard.service.ts` | 並列クエリ、メソッド分割パターン |
| `apps/api/src/lib/redis-store.ts` | キャッシュ関数パターン |
| `apps/admin/src/pages/Dashboard.tsx` | 既存UI構造、StatCard |
| `apps/api/src/routes/admin/auth.ts` | 管理者ルーターパターン |
| `packages/db/prisma/schema.prisma` | User, Organization, Subscription, Invoice モデル |

---

## 7. 検証方法

### 手動テスト
1. `docker compose up` で開発サーバー起動
2. 管理者ログイン（2FA込み）
3. ダッシュボードページでデータ表示確認
4. 各統計カードの値がDB実データと一致することを確認
5. システムヘルスが全て「正常」表示されることを確認
6. 更新ボタンでデータが再取得されることを確認

### 自動テスト
```bash
docker compose exec dev pnpm test -- --grep "AdminDashboardService"
docker compose exec dev pnpm test -- --grep "admin/dashboard"
```

### 確認項目
- [ ] ユーザー統計が正しく集計される
- [ ] 組織統計が正しく集計される
- [ ] テスト実行の成功率が正しく計算される
- [ ] MRRがアクティブサブスクリプションから計算される
- [ ] システムヘルスが各サービスの稼働状況を反映する
- [ ] Redisキャッシュが5分間有効（2回目のリクエストが高速）
- [ ] 未認証リクエストが401を返す
