# Step 0-5: requireAdminRole ミドルウェア実装プラン

## 概要

管理者のロールベース認可を行うミドルウェアを実装する。

## 現状の確認

### 既存の実装
- `apps/api/src/controllers/admin/auth.controller.ts` に `requireAdminAuth()` が存在
  - 認証のみ（ロールチェックなし）
  - AdminAuditLog への記録なし

### Step 0-5 で必要な実装
- 別ファイル `apps/api/src/middleware/require-admin-role.ts` に作成
- ロールベースの認可チェック
- AdminAuditLog への操作記録（オプション）

## 実装内容

### 作成ファイル
`apps/api/src/middleware/require-admin-role.ts`

### 関数

```typescript
// ロールベース認可ミドルウェア
export function requireAdminRole(roles: AdminRoleType[] = [])

// 認証のみのラッパー（ロールチェックなし）
export function requireAdminAuth()
```

### 処理フロー

1. Cookie (`admin_session`) からトークン取得
2. `AdminSessionService.validateSession()` でセッション検証
3. `req.adminUser`, `req.adminSession` を設定
4. ロール権限チェック:
   - `SUPER_ADMIN` は全権限
   - `roles` が空の場合は認証のみ
   - `roles` が指定されている場合は含まれるかチェック
5. 最終活動時刻を更新（非同期）

### 依存関係

| モジュール | インポート先 |
|-----------|-------------|
| `AdminSessionService` | `../services/admin/admin-session.service.js` |
| `extractClientInfo` | `./session.middleware.js` |
| `AuthenticationError`, `AuthorizationError` | `@agentest/shared` |
| `AdminRoleType` | `@agentest/db` |

### 参照する既存パターン

- `apps/api/src/middleware/require-test-suite-role.ts` - ミドルウェア構造
- `apps/api/src/controllers/admin/auth.controller.ts:32-68` - 既存の認証処理

## Express 型拡張

既に `apps/api/src/types/express.d.ts` に以下が定義済み:
- `req.adminUser`: `{ id, email, name, role, totpEnabled }`
- `req.adminSession`: `{ id, token, createdAt, expiresAt }`

## 移行方針

**既存の `auth.controller.ts` の `requireAdminAuth()` を削除して移行**

理由:
- 関心の分離: コントローラーにミドルウェアを含めるべきではない
- 一貫性: 他の権限ミドルウェアと同じディレクトリに配置
- 重複排除: 同じ機能のコードが2箇所に存在することを避ける

作業:
1. `apps/api/src/middleware/require-admin-role.ts` を新規作成
2. `apps/api/src/controllers/admin/auth.controller.ts` から `requireAdminAuth()` を削除
3. `apps/api/src/routes/admin/auth.ts` のインポートを新しいファイルに変更
4. テストファイルのインポートを更新

### 影響を受けるファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/middleware/require-admin-role.ts` | **新規作成** |
| `apps/api/src/controllers/admin/auth.controller.ts` | `requireAdminAuth()` 削除 |
| `apps/api/src/routes/admin/auth.ts` | インポート先変更 |
| `apps/api/src/__tests__/unit/admin-auth.controller.test.ts` | インポート先変更 |

## 検証方法

1. ユニットテスト: `apps/api/src/__tests__/unit/require-admin-role.middleware.test.ts`
   - 未認証リクエストで 401 エラー
   - 無効なセッションで 401 エラー
   - ロール不足で 403 エラー
   - SUPER_ADMIN は全ロールで許可
   - 正常認証時に `req.adminUser`, `req.adminSession` が設定される

2. 結合テスト: 実際のルートに適用して動作確認
   ```bash
   docker compose exec dev pnpm test --filter=api
   ```
