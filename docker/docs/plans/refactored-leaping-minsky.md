# システム管理者招待メール機能 実装計画

## 概要
招待トークンによるセキュアなパスワード設定フローを実装する。

## 実装タスク

### 1. DBスキーマ追加
**ファイル**: `packages/db/prisma/schema.prisma`

```prisma
model AdminInvitation {
  id           String        @id @default(uuid())
  email        String        @db.VarChar(255)
  name         String        @db.VarChar(100)
  role         AdminRoleType
  token        String        @unique @db.VarChar(255)
  invitedById  String        @map("invited_by_id")

  acceptedAt   DateTime?     @map("accepted_at")
  expiresAt    DateTime      @map("expires_at")
  createdAt    DateTime      @default(now()) @map("created_at")

  invitedBy    AdminUser     @relation(fields: [invitedById], references: [id])

  @@index([token])
  @@index([email])
  @@map("admin_invitations")
}
```

- AdminUserモデルに `invitations AdminInvitation[]` リレーション追加
- マイグレーション実行: `pnpm db:migrate`

### 2. 型定義・スキーマ追加
**ファイル**: `packages/shared/src/types/admin-system-admins.ts`

```typescript
// 招待受諾リクエスト
export interface AcceptInvitationRequest {
  password: string;
}

// 招待情報レスポンス
export interface AdminInvitationResponse {
  email: string;
  name: string;
  role: SystemAdminRole;
  invitedBy: string;
  expiresAt: string;
}
```

**ファイル**: `packages/shared/src/validators/schemas.ts`
- `acceptInvitationSchema` 追加（パスワードバリデーション）

### 3. メールテンプレート追加
**ファイル**: `apps/api/src/services/email.service.ts`

```typescript
// 招待メールテンプレート生成メソッド追加
generateAdminInvitationEmail(params: {
  name: string;
  inviterName: string;
  role: string;
  invitationUrl: string;
  expiresAt: Date;
}): { subject: string; text: string; html: string }
```

### 4. サービス層修正
**ファイル**: `apps/api/src/services/admin/system-admin.service.ts`

#### inviteAdminUser 修正
- AdminUser作成を削除
- AdminInvitation作成に変更
- トークン生成（crypto.randomUUID）
- 有効期限設定（24時間）
- メール送信追加

#### 新規メソッド追加
```typescript
// 招待情報取得
async getInvitation(token: string): Promise<AdminInvitationResponse>

// 招待受諾・パスワード設定
async acceptInvitation(token: string, password: string): Promise<{ adminUser: {...} }>
```

### 5. コントローラー・ルート追加
**ファイル**: `apps/api/src/controllers/admin/admin-users.controller.ts`
- `getInvitation`: GET /admin/invitations/:token
- `acceptInvitation`: POST /admin/invitations/:token/accept

**ファイル**: `apps/api/src/routes/admin/admin-users.ts`
- 認証不要のルートとして追加

### 6. フロントエンド実装
**ファイル**: `apps/admin/src/pages/auth/AcceptInvitation.tsx`

招待受諾ページ:
- トークンから招待情報を取得・表示
- パスワード設定フォーム
- エラー表示（期限切れ、使用済み、無効）

**ファイル**: `apps/admin/src/App.tsx`
- `/invitation/:token` ルート追加（認証不要）

**ファイル**: `apps/admin/src/lib/api.ts`
- `getInvitation`, `acceptInvitation` API関数追加

### 7. テスト追加
**ファイル**: `apps/api/src/__tests__/unit/system-admin.service.test.ts`
- 招待作成テスト
- 招待受諾テスト
- 期限切れテスト
- 使用済みトークンテスト

**ファイル**: `apps/api/src/__tests__/integration/system-admin.integration.test.ts`
- E2Eフロー: 招待作成 → メール送信 → 招待受諾

## 修正対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/prisma/schema.prisma` | AdminInvitationモデル追加 |
| `packages/shared/src/types/admin-system-admins.ts` | 型定義追加 |
| `packages/shared/src/validators/schemas.ts` | スキーマ追加 |
| `apps/api/src/services/email.service.ts` | テンプレート追加 |
| `apps/api/src/services/admin/system-admin.service.ts` | ロジック修正・追加 |
| `apps/api/src/controllers/admin/admin-users.controller.ts` | エンドポイント追加 |
| `apps/api/src/routes/admin/admin-users.ts` | ルート追加 |
| `apps/admin/src/pages/auth/AcceptInvitation.tsx` | 新規作成 |
| `apps/admin/src/App.tsx` | ルート追加 |
| `apps/admin/src/lib/api.ts` | API関数追加 |
| `apps/api/src/__tests__/unit/system-admin.service.test.ts` | テスト追加 |
| `apps/api/src/__tests__/integration/system-admin.integration.test.ts` | テスト追加 |

## 検証手順

1. **マイグレーション確認**
   ```bash
   docker compose exec dev pnpm db:migrate
   ```

2. **型チェック**
   ```bash
   docker compose exec dev pnpm exec tsc --noEmit
   ```

3. **テスト実行**
   ```bash
   docker compose exec dev pnpm --filter @agentest/api test -- --run src/__tests__/unit/system-admin.service.test.ts
   docker compose exec dev pnpm --filter @agentest/api test -- --run src/__tests__/integration/system-admin.integration.test.ts
   ```

4. **手動テスト**
   - SUPER_ADMINでログイン
   - 管理者を招待
   - Mailpit (http://localhost:8025) でメール確認
   - 招待リンクをクリック
   - パスワード設定
   - 新アカウントでログイン確認

5. **フロントエンドビルド**
   ```bash
   docker compose exec dev pnpm --filter @agentest/admin build
   ```
