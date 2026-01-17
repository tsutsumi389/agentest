# KPIサマリーカード - 実データ表示対応

## 概要
`ProjectOverviewTab`のモックデータを、実装済みのバックエンドAPIから取得した実データに置き換える。

## 変更ファイル

### 1. `apps/web/src/lib/api.ts` (840行目付近)
`projectsApi`に`getDashboard`メソッドを追加

```typescript
// getTestSuites の後に追加
getDashboard: (projectId: string) =>
  api.get<ProjectDashboardStats>(`/api/projects/${projectId}/dashboard`),
```

※ `ProjectDashboardStats`型のインポートも追加が必要

### 2. `apps/web/src/components/project/ProjectOverviewTab.tsx`
- 1行目: `projectsApi`のインポートを有効化
- 4-5行目: TODOコメントを削除
- 20-53行目: モックデータ部分を実際のAPI呼び出しに置換

修正後の`fetchDashboard`:
```typescript
async function fetchDashboard() {
  try {
    setIsLoading(true);
    setError(null);
    const data = await projectsApi.getDashboard(projectId);
    setStats(data);
  } catch {
    setError('ダッシュボードの取得に失敗しました');
  } finally {
    setIsLoading(false);
  }
}
```

## 検証方法
1. `docker compose exec dev pnpm build` - ビルドエラーがないことを確認
2. ブラウザでプロジェクト概要タブを開き、KPIカードにAPIデータが表示されることを確認
