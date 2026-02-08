# Step 1: DBスキーマ拡張 + バリデーションスキーマ

## 概要

メール/パスワード認証の基盤となるDBスキーマの変更とZodバリデーションスキーマの追加。
後続のすべてのステップがこのステップに依存する。

## 前提条件

- なし（最初のステップ）

---

## 1.1 DBスキーマ拡張

### 変更ファイル: `packages/db/prisma/schema.prisma`

#### User モデルにフィールド追加

```prisma
model User {
  // ... 既存フィールド ...
  passwordHash    String?   @map("password_hash") @db.VarChar(255)
  failedAttempts  Int       @default(0) @map("failed_attempts")
  lockedUntil     DateTime? @map("locked_until")
  // ... 既存リレーション ...
  passwordResetTokens PasswordResetToken[]
}
```

- `passwordHash`: nullable（OAuthのみのユーザーはnull）
- `failedAttempts`: ブルートフォース対策（AdminUserモデルと同パターン）
- `lockedUntil`: アカウントロック（AdminUserモデルと同パターン）

#### PasswordResetToken モデルの新規追加

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

### マイグレーション実行

```bash
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name add-user-password-auth
```

---

## 1.2 バリデーションスキーマ追加（TDD）

### 変更ファイル: `packages/shared/src/validators/schemas.ts`

### テストファイル（新規）: `packages/shared/src/validators/__tests__/password-schemas.test.ts`

### RED: テストを先に書く

```typescript
import { describe, it, expect } from 'vitest';
import {
  passwordSchema,
  userRegisterSchema,
  userLoginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  setPasswordSchema,
  changePasswordSchema,
} from '../schemas.js';

describe('passwordSchema', () => {
  it('8文字以上で大文字・小文字・数字・記号を含むパスワードを受け入れる', () => {
    expect(passwordSchema.safeParse('Test1234!').success).toBe(true);
  });

  it('8文字未満のパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('Te1!');
    expect(result.success).toBe(false);
  });

  it('大文字を含まないパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('test1234!');
    expect(result.success).toBe(false);
  });

  it('小文字を含まないパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('TEST1234!');
    expect(result.success).toBe(false);
  });

  it('数字を含まないパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('TestTest!');
    expect(result.success).toBe(false);
  });

  it('記号を含まないパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('Test1234');
    expect(result.success).toBe(false);
  });

  it('100文字を超えるパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('A'.repeat(90) + 'a1!'.padEnd(11, 'x'));
    expect(result.success).toBe(false);
  });
});

describe('userRegisterSchema', () => {
  const validData = {
    email: 'test@example.com',
    password: 'Test1234!',
    name: 'テストユーザー',
  };

  it('有効なデータを受け入れる', () => {
    expect(userRegisterSchema.safeParse(validData).success).toBe(true);
  });

  it('メールアドレスが無効な場合は拒否する', () => {
    expect(userRegisterSchema.safeParse({ ...validData, email: 'invalid' }).success).toBe(false);
  });

  it('名前が空の場合は拒否する', () => {
    expect(userRegisterSchema.safeParse({ ...validData, name: '' }).success).toBe(false);
  });

  it('パスワードが要件を満たさない場合は拒否する', () => {
    expect(userRegisterSchema.safeParse({ ...validData, password: 'weak' }).success).toBe(false);
  });
});

describe('userLoginSchema', () => {
  it('有効なデータを受け入れる', () => {
    expect(userLoginSchema.safeParse({ email: 'test@example.com', password: 'any' }).success).toBe(true);
  });

  it('メールが無効な場合は拒否する', () => {
    expect(userLoginSchema.safeParse({ email: 'invalid', password: 'any' }).success).toBe(false);
  });

  it('パスワードが空の場合は拒否する', () => {
    expect(userLoginSchema.safeParse({ email: 'test@example.com', password: '' }).success).toBe(false);
  });
});

describe('passwordResetRequestSchema', () => {
  it('有効なメールアドレスを受け入れる', () => {
    expect(passwordResetRequestSchema.safeParse({ email: 'test@example.com' }).success).toBe(true);
  });

  it('無効なメールアドレスを拒否する', () => {
    expect(passwordResetRequestSchema.safeParse({ email: 'invalid' }).success).toBe(false);
  });
});

describe('passwordResetSchema', () => {
  it('有効なトークンとパスワードを受け入れる', () => {
    expect(passwordResetSchema.safeParse({ token: 'abc123', password: 'Test1234!' }).success).toBe(true);
  });

  it('トークンが空の場合は拒否する', () => {
    expect(passwordResetSchema.safeParse({ token: '', password: 'Test1234!' }).success).toBe(false);
  });

  it('パスワードが要件を満たさない場合は拒否する', () => {
    expect(passwordResetSchema.safeParse({ token: 'abc123', password: 'weak' }).success).toBe(false);
  });
});

describe('setPasswordSchema', () => {
  it('有効なパスワードを受け入れる', () => {
    expect(setPasswordSchema.safeParse({ password: 'Test1234!' }).success).toBe(true);
  });
});

describe('changePasswordSchema', () => {
  it('有効な現在のパスワードと新しいパスワードを受け入れる', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    }).success).toBe(true);
  });

  it('新しいパスワードが要件を満たさない場合は拒否する', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'OldPass1!',
      newPassword: 'weak',
    }).success).toBe(false);
  });
});
```

### GREEN: 実装

`packages/shared/src/validators/schemas.ts` に以下を追加:

```typescript
// パスワード共通バリデーション
// パスワード要件: 8文字以上100文字以内、大文字・小文字・数字・記号を含む
export const passwordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上で入力してください')
  .max(100, 'パスワードは100文字以内で入力してください')
  .regex(/[A-Z]/, 'パスワードには大文字を含めてください')
  .regex(/[a-z]/, 'パスワードには小文字を含めてください')
  .regex(/[0-9]/, 'パスワードには数字を含めてください')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'パスワードには記号を含めてください');

// ユーザー新規登録
export const userRegisterSchema = z.object({
  email: z.string().email().max(255),
  password: passwordSchema,
  name: z.string().min(1).max(100),
});

export type UserRegister = z.infer<typeof userRegisterSchema>;

// ユーザーログイン（パスワード強度チェックは不要、ログイン時は任意文字列でOK）
export const userLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type UserLogin = z.infer<typeof userLoginSchema>;

// パスワードリセット要求
export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

// パスワードリセット実行
export const passwordResetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type PasswordReset = z.infer<typeof passwordResetSchema>;

// パスワード初回設定（OAuthユーザーがパスワードを追加）
export const setPasswordSchema = z.object({
  password: passwordSchema,
});

export type SetPassword = z.infer<typeof setPasswordSchema>;

// パスワード変更
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type ChangePassword = z.infer<typeof changePasswordSchema>;
```

### REFACTOR: acceptInvitationSchema のリファクタリング

既存の `acceptInvitationSchema` を `passwordSchema` を参照するように変更:

```typescript
// 変更前
export const acceptInvitationSchema = z.object({
  password: z.string().min(8, '...').max(100, '...')... // 直接定義
});

// 変更後
export const acceptInvitationSchema = z.object({
  password: passwordSchema,
});
```

---

## 検証

```bash
# バリデーションテスト
docker compose exec dev pnpm --filter @agentest/shared test -- --run password-schemas

# マイグレーション確認
docker compose exec dev pnpm --filter @agentest/db prisma migrate status

# 全体ビルド
docker compose exec dev pnpm build

# 全テスト
docker compose exec dev pnpm test
```

## 成果物

### 変更ファイル
- `packages/db/prisma/schema.prisma` — User フィールド追加 + PasswordResetToken モデル
- `packages/shared/src/validators/schemas.ts` — パスワード関連スキーマ追加 + acceptInvitationSchema リファクタ

### 新規ファイル
- `packages/shared/src/validators/__tests__/password-schemas.test.ts` — バリデーションテスト
- `packages/db/prisma/migrations/xxx_add_user_password_auth/migration.sql` — マイグレーション（自動生成）

## 次のステップ

→ [Step 2: パスワード認証サービス](./password-auth-step-2-auth-service.md)
→ [Step 3: メールテンプレート](./password-auth-step-3-email-templates.md)
