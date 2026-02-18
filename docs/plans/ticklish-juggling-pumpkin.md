# 初回セットアップウィザード実装プラン

## Context

AgentestをOSS化した際、初回デプロイ時に管理者アカウントが存在しない。現状は `seed-admin.ts` スクリプトでシード投入が必要だが、OSSユーザーにとっては不便。初回起動時にブラウザからSUPER_ADMINアカウントを作成できるセットアップウィザードを実装し、セットアップの敷居を下げる。

---

## 実装方針

### 検出ロジック

`AdminUser`（`deletedAt IS NULL`）が0件 → セットアップ未完了と判定。
新たなDBモデルは追加しない（既存データで判定可能）。

### ステップ

1. 管理者アカウント作成（名前・メール・パスワード）のみ

---

## 変更ファイル一覧

### Backend（API）

#### 1. セットアップルート新規作成
**新規:** `apps/api/src/routes/admin/setup.ts`

```typescript
// GET  /admin/setup/status → { isSetupRequired: boolean }
// POST /admin/setup         → SUPER_ADMINアカウント作成
```

- **GET /admin/setup/status**: 認証不要。`AdminUser`の件数を確認し `isSetupRequired` を返す
- **POST /admin/setup**: 認証不要。AdminUserが1件でも存在すれば `403` を返す。バリデーションは既存の `passwordSchema` を再利用。bcryptハッシュ（rounds=12）で `SUPER_ADMIN` ロールのAdminUserを作成

#### 2. ルート登録
**変更:** `apps/api/src/routes/admin/index.ts`

- `/admin/setup` ルートを `requireAdminAuth` なしで登録

#### 3. コントローラー新規作成
**新規:** `apps/api/src/controllers/admin/setup.controller.ts`

- `getSetupStatus()`: `prisma.adminUser.count({ where: { deletedAt: null } })` で判定
- `initialSetup()`: バリデーション → 存在チェック → AdminUser作成 → 監査ログ記録

#### 4. バリデーションスキーマ追加
**変更:** `packages/shared/src/validators/schemas.ts`

```typescript
export const initialSetupSchema = z.object({
  email: z.string().email().max(255).transform(v => v.toLowerCase().trim()),
  name: z.string().min(1).max(100),
  password: passwordSchema,
});
```

### Frontend（Admin App）

#### 5. セットアップページ新規作成
**新規:** `apps/admin/src/pages/auth/Setup.tsx`

- フルスクリーンレイアウト（ヘッダー・サイドバーなし、ログインページと同様の構造）
- フォームフィールド: 名前、メールアドレス、パスワード、パスワード確認
- パスワード要件チェックリスト（`AcceptInvitation.tsx` のUI パターンを踏襲）
- 送信後 → 成功メッセージ表示 → `/login` へリダイレクト

#### 6. API クライアント拡張
**変更:** `apps/admin/src/lib/api.ts`

```typescript
export const setupApi = {
  getStatus: () => get<{ isSetupRequired: boolean }>('/admin/setup/status'),
  setup: (data: { email: string; name: string; password: string }) =>
    post<{ admin: { id: string; email: string; name: string } }>('/admin/setup', data),
};
```

#### 7. ルーティング更新
**変更:** `apps/admin/src/App.tsx`

- `/setup` ルートを公開ルートとして追加（`/login` と同列）
- `AuthGuard` にセットアップ未完了時の `/setup` リダイレクトロジックを追加

#### 8. AuthGuard 更新
**変更:** `apps/admin/src/components/layout/AuthGuard.tsx`

- 初期化時に `GET /admin/setup/status` を呼び出し
- `isSetupRequired === true` の場合、`/setup` にリダイレクト

#### 9. ログインページ更新
**変更:** `apps/admin/src/pages/auth/Login.tsx`

- ログインページでもセットアップ状態を確認し、未完了なら `/setup` にリダイレクト

---

## 既存コードの再利用

| 再利用対象 | ファイルパス | 用途 |
|-----------|-------------|------|
| `passwordSchema` | `packages/shared/src/validators/schemas.ts` | パスワードバリデーション |
| bcrypt ハッシュパターン | `apps/api/src/services/admin/system-admin.service.ts` | `bcrypt.hash(password, 12)` |
| ログインページUI | `apps/admin/src/pages/auth/Login.tsx` | レイアウト・スタイルの参考 |
| 招待承認ページUI | `apps/admin/src/pages/auth/AcceptInvitation.tsx` | パスワード要件チェックリストUI |
| AdminAuditLog パターン | `apps/api/src/services/admin/system-admin.service.ts` | 監査ログ記録 |
| `ApiError` クラス | `apps/admin/src/lib/api.ts` | エラーハンドリング |

---

## セキュリティ考慮

- **POST /admin/setup** はAdminUserが1件でも存在すれば `403 Forbidden` → 既存環境での悪用防止
- パスワードは既存の `passwordSchema`（8文字以上、大文字・小文字・数字・記号必須）で検証
- bcrypt rounds=12 で既存と統一
- セットアップ完了後はエンドポイント自体が無効化される（AdminUser存在チェック）

---

## 検証方法

1. **新規環境テスト**: AdminUserが0件の状態で `/admin` にアクセス → `/setup` にリダイレクトされること
2. **セットアップ実行**: フォーム入力 → SUPER_ADMIN作成 → `/login` にリダイレクト → ログイン成功
3. **再アクセス防止**: セットアップ完了後に `/setup` にアクセス → `/login` にリダイレクト
4. **API防御**: AdminUser存在時に `POST /admin/setup` → `403` エラー
5. **バリデーション**: 不正なメール・弱いパスワードで適切なエラー表示
6. **ユニットテスト**: コントローラー・バリデーションのテスト追加
