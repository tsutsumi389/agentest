# ダッシュボードAPI側の簡素化

## 概要
ダッシュボード画面の簡素化（`rosy-munching-sedgewick.md`）に伴い、使用されなくなったAPI側のコードを削除する。

## 背景
フロントエンドで以下の機能が削除された：
- ダッシュボード統計データ（プロジェクト数、テストスイート数、成功/失敗数）
- 最近の実行セクション
- サイドバー（今週のテスト実行回数、最終実行日時など）

これにより `GET /api/users/:userId/dashboard` エンドポイントが不要になった。

## 削除対象

### 1. ルート定義
**ファイル**: `apps/api/src/routes/users.ts`
- 行53-57: ダッシュボードルート定義を削除
```typescript
/**
 * ダッシュボード統計取得
 * GET /api/users/:userId/dashboard
 */
router.get('/:userId/dashboard', requireAuth(authConfig), userController.getDashboard);
```

### 2. コントローラー
**ファイル**: `apps/api/src/controllers/user.controller.ts`
- 行208-227: `getDashboard` メソッドを削除

### 3. サービス
**ファイル**: `apps/api/src/services/user.service.ts`
- 行5-37: `DashboardStats` インターフェース定義を削除
- 行335-500: `getDashboardStats` メソッドを削除

### 4. APIクライアント（フロントエンド）
**ファイル**: `apps/web/src/lib/api.ts`
- 行835-867: `DashboardStats` インターフェース定義を削除
- 行893-894: `usersApi.getDashboardStats()` メソッドを削除

## 継続使用されるAPI
- `GET /api/users/:userId/projects` - プロジェクト一覧（継続使用）
- `GET /api/projects/:projectId/dashboard` - プロジェクトダッシュボード（別機能）

## 検証方法
1. `docker compose exec dev pnpm build` でビルドエラーがないことを確認
2. `docker compose exec dev pnpm test` でテストが通ることを確認
3. ブラウザでダッシュボード画面を表示し、プロジェクト一覧が正常に表示されることを確認
