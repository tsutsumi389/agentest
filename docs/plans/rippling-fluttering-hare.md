# 管理者ユーザーシーダー追加計画

## 概要
テスト用管理者ユーザー（admin@example.com / password123）をシーダーに追加する。

## 変更対象ファイル

### 1. `packages/db/package.json`
bcryptjs依存関係を追加

### 2. `packages/db/prisma/seed.ts`
AdminUserのシード処理を追加

## 実装詳細

### package.json変更
```json
"dependencies": {
  "@prisma/client": "catalog:",
  "bcryptjs": "^3.0.3"
}
```

### seed.ts変更

importに追加:
```typescript
import { PrismaClient, UserPlan, OrganizationPlan, EntityStatus, TestCasePriority, AdminRoleType } from '@prisma/client';
import bcryptjs from 'bcryptjs';
```

main()関数の先頭に追加:
```typescript
// パスワードハッシュのコストファクター（admin-auth.serviceと同じ値）
const BCRYPT_ROUNDS = 12;

// ===== 管理者ユーザーをシード =====
const adminPasswordHash = bcryptjs.hashSync('password123', BCRYPT_ROUNDS);
const adminUser = await prisma.adminUser.upsert({
  where: { email: 'admin@example.com' },
  update: {},
  create: {
    email: 'admin@example.com',
    passwordHash: adminPasswordHash,
    name: 'テスト管理者',
    role: AdminRoleType.SUPER_ADMIN,
    totpEnabled: false,
    failedAttempts: 0,
  },
});

console.log('管理者ユーザーを作成:', adminUser.email);
```

## 設計判断

| 項目 | 判断 | 理由 |
|------|------|------|
| ロール | SUPER_ADMIN | テスト用に全権限付与 |
| TOTP | 無効 | ログインテストを簡易化 |
| upsert使用 | する | 複数回実行しても安全 |
| bcryptラウンド | 12 | 既存のadmin-auth.serviceと同じ |

## 検証方法

```bash
# 依存関係インストール
docker compose exec dev pnpm --filter @agentest/db add bcryptjs

# シード実行
docker compose exec dev pnpm --filter @agentest/db db:seed

# 確認（Prisma Studioで）
docker compose exec dev pnpm --filter @agentest/db db:studio
```

管理画面（/admin/login）でログインして動作確認:
- Email: admin@example.com
- Password: password123
