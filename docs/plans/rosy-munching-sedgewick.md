# ダッシュボード画面の簡素化

## ステータス: 完了

## 概要
ダッシュボード画面から以下の要素を削除し、シンプルな構成に変更する。

## 対象ファイル
- `apps/web/src/pages/Dashboard.tsx`

## 削除する要素

### 1. ウェルカムメッセージ（行99-106）
```tsx
<h1 className="text-2xl font-bold text-foreground">
  おかえりなさい、{user?.name}
</h1>
<p className="text-foreground-muted mt-1">
  プロジェクトの状況を確認しましょう
</p>
```

### 2. 統計カード（行117-147）
プロジェクト、テストスイート、成功、失敗の4つのカードを削除

### 3. サイドメニュー（行85-94、266-335）
- `usePageSidebar` フックの使用
- `DashboardSidebar` コンポーネント全体

### 4. 最近の実行セクション（行202-258）
最近の実行テーブル全体を削除

## 残す要素
- **最近のプロジェクト**（行149-200）: プロジェクト一覧のみ残す

## 不要になるコード

### import の削除
- `Play`, `CheckCircle2`, `XCircle`, `Plus`, `Clock`, `TrendingUp`, `FileText`
- `usePageSidebar`
- `StatusBadge`, `ProgressBar`
- `DashboardStats` 型（サイドバーで使用）

### 関数・コンポーネントの削除
- `formatRelativeTime` 関数
- `mapExecutionStatus` 関数
- `DashboardSidebar` コンポーネント
- `StatCard` コンポーネント

## 変更後の構成

```tsx
// シンプルな構成
export function DashboardPage() {
  const { user } = useAuthStore();

  // プロジェクト一覧のみ取得
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['user-projects', user?.id],
    queryFn: () => usersApi.getProjects(user!.id),
    enabled: !!user?.id,
  });

  const projects = projectsData?.projects || [];

  return (
    <div className="space-y-6">
      {/* 最近のプロジェクト - これのみ残す */}
      <div className="card">...</div>
    </div>
  );
}
```

## 検証方法
1. `docker compose exec dev pnpm build` でビルドエラーがないことを確認
2. ブラウザでダッシュボード画面を表示し、以下を確認：
   - ウェルカムメッセージが表示されていない
   - 統計カードが表示されていない
   - サイドメニューが表示されていない
   - 最近の実行セクションが表示されていない
   - 最近のプロジェクト一覧のみが表示されている
