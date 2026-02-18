# メール認証の省略オプション (TDD実装)

## Context

OSS向けセルフホスト環境では SMTP 設定が面倒な場合が多い。環境変数 `REQUIRE_EMAIL_VERIFICATION=false` でメール認証をスキップ可能にし、SMTP なしでも利用開始できるようにする。デフォルトは `true`（既存動作を完全維持）。

## 変更ファイル一覧

| ファイル | 変更 |
|---------|------|
| `apps/api/src/config/env.ts` | `REQUIRE_EMAIL_VERIFICATION` 環境変数追加 |
| `apps/api/src/services/user-password-auth.service.ts` | `register()` 分岐、`RegisterResult` 型変更、`env` import追加 |
| `apps/api/src/controllers/auth.controller.ts` | `register()` レスポンス分岐 |
| `apps/web/src/lib/api.ts` | register レスポンス型に `emailVerificationSkipped` 追加 |
| `apps/web/src/pages/Register.tsx` | 登録後リダイレクト先分岐 |
| `.env.example` | `REQUIRE_EMAIL_VERIFICATION` 追加 |
| `apps/api/src/__tests__/unit/user-password-auth.service.test.ts` | env モック追加、false 時のテスト追加 |
| `apps/api/src/__tests__/integration/auth-password.integration.test.ts` | false 時の統合テスト追加 |
| `apps/api/src/__tests__/integration/test-helpers.ts` | `cleanupTestData` に `emailVerificationToken` 追加 |

## 設計

### RegisterResult 型（判別共用体に変更）

```typescript
export type RegisterResult =
  | { requiresEmailVerification: true; verificationToken: string; user: {...} }
  | { requiresEmailVerification: false; tokens: TokenPair; user: {...} };
```

### `REQUIRE_EMAIL_VERIFICATION=false` 時の動作

- **register()**: `emailVerified: true` で作成、トークン不作成、JWT即発行（セッション+RefreshToken作成）
- **コントローラー**: クッキー設定、レスポンスに `emailVerificationSkipped: true`
- **フロントエンド**: `/check-email` ではなく `/`（ダッシュボード）へリダイレクト
- **verifyEmail/resendVerification**: エンドポイントは残す（変更なし）

### セキュリティ

- 本番環境で `false` の場合、起動時に `logger.warn` で警告

---

## TDD 実装手順

### Phase 1: 環境変数追加

**`apps/api/src/config/env.ts`** (行83、SMTP_SECURE の後):
```typescript
// メール認証要否（セルフホスト環境では false でスキップ可能）
REQUIRE_EMAIL_VERIFICATION: z.string().default('true').transform((val) => val === 'true'),
```

`validateEnv()` に本番警告ログ追加。

**`.env.example`** (SMTP セクションに追加):
```env
# メール認証をスキップする場合は false（SMTP設定不要になる）
REQUIRE_EMAIL_VERIFICATION=true
```

### Phase 2: サービス層 (RED → GREEN → REFACTOR)

#### RED: テスト追加

**`apps/api/src/__tests__/unit/user-password-auth.service.test.ts`**

env モック追加（既存モック群の後に）:
```typescript
const mockEnv = vi.hoisted(() => ({
  REQUIRE_EMAIL_VERIFICATION: true,
}));
vi.mock('../../config/env.js', () => ({ env: mockEnv }));
```

新テスト `describe('register (メール認証スキップ)')`:
- `emailVerified: true` でユーザー作成される
- `EmailVerificationToken` が作成されない
- `requiresEmailVerification: false` と `tokens` を返す
- `RefreshToken` と `Session` が作成される

既存 register テストの修正:
- `result.verificationToken` → `result.requiresEmailVerification === true` を判別してからアクセス

#### GREEN: サービス実装

**`apps/api/src/services/user-password-auth.service.ts`**

1. `import { env } from '../config/env.js'` 追加
2. `RegisterResult` を interface から判別共用体 type に変更
3. `register()` に `ipAddress?`, `userAgent?` 引数追加
4. `env.REQUIRE_EMAIL_VERIFICATION` で分岐:
   - `true`: 既存フロー（トークン生成→メール確認待ち）
   - `false`: `emailVerified: true` で作成、JWT発行、セッション作成

`false` 時の処理は既存の `login()` メソッド（行232-278）のセッション作成パターンを再利用。

### Phase 3: コントローラー層 (RED → GREEN → REFACTOR)

#### RED: 統合テスト追加

**`apps/api/src/__tests__/integration/auth-password.integration.test.ts`**

`env` をインポートし、`describe('POST /api/auth/register (メール認証スキップ)')` を追加:
```typescript
import { env } from '../../config/env.js';

// beforeEach で env.REQUIRE_EMAIL_VERIFICATION = false に書き換え
// afterEach で元の値に復元
```

テストケース:
- クッキーが設定される
- `emailVerified: true` でDB保存
- `EmailVerificationToken` が作成されない
- `emailService.send` が呼ばれない
- セッションが作成される
- レスポンスに `emailVerificationSkipped: true`

#### GREEN: コントローラー実装

**`apps/api/src/controllers/auth.controller.ts`**

`register()` を `result.requiresEmailVerification` で分岐:
- `true`: 既存フロー（メール送信、201、クッキーなし）
- `false`: `this.setAuthCookies(res, result.tokens)` → 201 + `emailVerificationSkipped: true`

`extractClientInfo(req)` の結果を `register()` 呼び出しに渡す。

### Phase 4: フロントエンド

**`apps/web/src/lib/api.ts`** (行826-827):
レスポンス型に `emailVerificationSkipped?: boolean` 追加。

**`apps/web/src/pages/Register.tsx`** (行45-47):
```typescript
if (result.emailVerificationSkipped) {
  navigate('/', { replace: true });  // ダッシュボードへ
} else {
  navigate(`/check-email?email=${encodeURIComponent(email)}`, { replace: true });
}
```

### Phase 5: テストヘルパー修正

**`apps/api/src/__tests__/integration/test-helpers.ts`** (行248、`passwordResetToken` の前):
```typescript
await prisma.emailVerificationToken.deleteMany({});
```

---

## 検証

```bash
# ユニットテスト
docker compose exec dev pnpm test -- --filter=api -- src/__tests__/unit/user-password-auth.service.test.ts

# 統合テスト
docker compose exec dev pnpm test -- --filter=api -- src/__tests__/integration/auth-password.integration.test.ts

# ビルド確認
docker compose exec dev pnpm build

# 全テスト
docker compose exec dev pnpm test
```

手動確認:
1. `REQUIRE_EMAIL_VERIFICATION=true`（デフォルト）で既存フロー通りメール確認必須
2. `REQUIRE_EMAIL_VERIFICATION=false` で登録後即ダッシュボードへ遷移
