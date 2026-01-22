# 管理者認証機能 ユニットテスト・結合テスト実装計画

## 概要

管理者認証API（Step 1-5で実装済み）のユニットテストと結合テストを作成する。

---

## ファイル構成

### 新規作成ファイル（8ファイル）

| ファイルパス | 責務 |
|------------|------|
| `apps/api/src/__tests__/unit/admin-user.repository.test.ts` | AdminUserRepository テスト |
| `apps/api/src/__tests__/unit/admin-session.repository.test.ts` | AdminSessionRepository テスト |
| `apps/api/src/__tests__/unit/admin-session.service.test.ts` | AdminSessionService テスト |
| `apps/api/src/__tests__/unit/admin-auth.service.test.ts` | AdminAuthService テスト |
| `apps/api/src/__tests__/unit/admin-audit-log.service.test.ts` | AdminAuditLogService テスト |
| `apps/api/src/__tests__/unit/admin-auth.controller.test.ts` | AdminAuthController & requireAdminAuth テスト |
| `apps/api/src/__tests__/integration/admin-auth.integration.test.ts` | 管理者認証API結合テスト |

### 修正ファイル（1ファイル）

| ファイルパス | 変更内容 |
|------------|----------|
| `apps/api/src/__tests__/integration/test-helpers.ts` | 管理者用ヘルパー関数追加 |

---

## 実装順序

### Phase 1: テストヘルパー追加

`test-helpers.ts` に以下を追加:

```typescript
// 管理者用ヘルパー関数
createTestAdminUser()      // テスト用管理者ユーザー作成
createTestAdminSession()   // テスト用管理者セッション作成
createTestAdminAuditLog()  // テスト用監査ログ作成

// cleanupTestData() に追加
await prisma.adminAuditLog.deleteMany({});
await prisma.adminSession.deleteMany({});
await prisma.adminUser.deleteMany({});
```

### Phase 2: リポジトリテスト

#### admin-user.repository.test.ts

| メソッド | テストケース |
|---------|-------------|
| findByEmailWithPassword | 存在するユーザーを取得できる |
| | 削除済みユーザーは取得されない |
| | 存在しないユーザーはnullを返す |
| findById | IDでユーザーを取得できる（パスワードなし） |
| incrementFailedAttempts | 失敗回数をインクリメントできる |
| lockAccount | アカウントをロックできる |
| resetFailedAttempts | 失敗回数とロックをリセットできる |

#### admin-session.repository.test.ts

| メソッド | テストケース |
|---------|-------------|
| create | セッションを作成できる |
| findByToken | トークンでセッションを取得できる（adminUser含む） |
| findById | IDでセッションを取得できる |
| updateLastActiveAt | 最終活動時刻を更新できる |
| extendExpiry | 有効期限を延長できる |
| revoke | IDでセッションを失効できる |
| revokeByToken | トークンでセッションを失効できる |
| revokeAllByUserId | 管理者の全セッションを失効できる |
| deleteExpired | 30日以上経過した期限切れ/失効セッションを削除 |

### Phase 3: サービステスト（コア）

#### admin-session.service.test.ts

| メソッド | テストケース | 優先度 |
|---------|-------------|--------|
| generateToken | 128文字のセキュアなトークンを生成する | 高 |
| createSession | セッションを作成できる（2時間有効） | 高 |
| validateSession | 有効なセッションを検証できる | 高 |
| | 存在しないセッションはnullを返す | 高 |
| | 失効済みセッションはnullを返す | 高 |
| | 期限切れセッションはnullを返す | 高 |
| | 削除済み管理者のセッションはnullを返す | 高 |
| refreshSession | セッション有効期限を延長できる（2時間延長） | 中 |
| | **最大延長期限（8時間）を超えない** | 高 |
| | 最大延長期限を超過している場合はnullを返す | 高 |
| revokeSession | トークンでセッションを失効できる | 中 |
| updateActivity | 最終活動時刻を更新できる | 低 |

#### admin-auth.service.test.ts

| メソッド | テストケース | 優先度 |
|---------|-------------|--------|
| hashPassword | パスワードをハッシュ化できる（BCRYPT_ROUNDS=12） | 中 |
| login | 正しい認証情報でログインできる | 高 |
| | ログイン成功時に失敗回数をリセットする | 高 |
| | ログイン成功時に監査ログを記録する（LOGIN_SUCCESS） | 高 |
| | 存在しないユーザーで認証エラー | 高 |
| | **タイミング攻撃対策: ユーザー不在でもbcrypt実行** | 最高 |
| | 不正パスワードで認証エラー | 高 |
| | 不正パスワード時に失敗回数をインクリメント | 高 |
| | 不正パスワード時に監査ログを記録する（LOGIN_FAILED） | 高 |
| | **5回失敗でアカウントをロック** | 最高 |
| | アカウントロック時に監査ログを記録（ACCOUNT_LOCKED） | 高 |
| | **ロック中ユーザーはログイン拒否** | 最高 |
| | ロック中ログイン試行で監査ログを記録（LOGIN_BLOCKED_LOCKED） | 高 |
| logout | ログアウト処理を実行できる | 中 |
| | ログアウト時に監査ログを記録する（LOGOUT） | 中 |
| refreshSession | セッション延長を実行できる | 中 |
| | 延長成功時に監査ログを記録する（SESSION_REFRESHED） | 中 |

#### admin-audit-log.service.test.ts

| メソッド | テストケース | 優先度 |
|---------|-------------|--------|
| log | 監査ログを記録できる | 高 |
| | actionが空の場合は記録をスキップ | 高 |
| | **DB書込みエラー時もメイン処理に影響しない** | 高 |

### Phase 4: コントローラー・ミドルウェアテスト

#### admin-auth.controller.test.ts

**requireAdminAuth ミドルウェア:**

| テストケース | 優先度 |
|-------------|--------|
| クッキーからトークンを取得して認証できる | 高 |
| req.adminUser, req.adminSessionを設定する | 高 |
| クッキーがない場合はAuthenticationError | 高 |
| 無効なセッションの場合はAuthenticationError | 高 |

**AdminAuthController:**

| メソッド | テストケース | 優先度 |
|---------|-------------|--------|
| login | ログイン成功時にクッキーを設定する | 高 |
| | バリデーションエラー: メール形式不正 | 中 |
| | バリデーションエラー: パスワード空 | 中 |
| logout | ログアウト成功時にクッキーをクリアする | 高 |
| | 未認証の場合はAuthenticationError | 高 |
| me | 現在の管理者情報を取得できる | 中 |
| refresh | セッション延長成功時にクッキーを更新する | 中 |
| | 延長失敗時はAuthenticationError | 中 |

### Phase 5: 結合テスト

#### admin-auth.integration.test.ts

| エンドポイント | テストケース | 優先度 |
|---------------|-------------|--------|
| POST /admin/auth/login | 正しい認証情報でログインできる | 高 |
| | セッションクッキーが設定される | 高 |
| | セッションがDBに作成される | 高 |
| | 監査ログが記録される | 高 |
| | 不正パスワードで401エラー | 高 |
| | **5回失敗でアカウントロック** | 最高 |
| | **ロック中は正しいパスワードでもログイン不可** | 最高 |
| | **ロック時間（30分）経過後はログイン可能** | 高 |
| | メール形式不正で400エラー | 中 |
| POST /admin/auth/logout | ログアウトに成功する | 高 |
| | セッションが失効する | 高 |
| | クッキーがクリアされる | 高 |
| | 未認証の場合は401エラー | 高 |
| GET /admin/auth/me | 認証済み管理者情報を取得できる | 中 |
| | 期限切れセッションで401エラー | 高 |
| | 失効済みセッションで401エラー | 高 |
| POST /admin/auth/refresh | セッション延長に成功する | 中 |
| | **最大延長期限（8時間）を超えると延長不可** | 高 |

---

## テストデータ例

### 管理者ユーザー
```typescript
const testAdminUser = {
  id: 'admin-user-1',
  email: 'admin@example.com',
  passwordHash: '$2b$12$...', // 'TestPassword123!'
  name: 'Test Admin',
  role: 'ADMIN',
  totpEnabled: false,
  failedAttempts: 0,
  lockedUntil: null,
  deletedAt: null,
};
```

### 管理者セッション
```typescript
const testAdminSession = {
  id: 'session-1',
  adminUserId: 'admin-user-1',
  token: 'a'.repeat(128), // 128文字hex
  userAgent: 'Mozilla/5.0 Test Browser',
  ipAddress: '127.0.0.1',
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2時間後
  revokedAt: null,
};
```

---

## 重要なセキュリティテスト

### 1. タイミング攻撃対策
```typescript
it('タイミング攻撃対策: ユーザーが存在しなくてもbcrypt.compareを実行する', async () => {
  mockUserRepo.findByEmailWithPassword.mockResolvedValue(null);
  mockBcrypt.compare.mockResolvedValue(false);

  await expect(authService.login({ email: 'nonexistent@example.com', password: 'any' }))
    .rejects.toThrow(AuthenticationError);

  // DUMMY_PASSWORD_HASHに対してcompareが呼ばれることを確認
  expect(mockBcrypt.compare).toHaveBeenCalledWith('any', expect.stringMatching(/^\$2b\$12\$/));
});
```

### 2. アカウントロック
```typescript
it('5回失敗でアカウントをロックする', async () => {
  const mockUser = { id: 'user-1', passwordHash: 'hash', failedAttempts: 4 };
  mockUserRepo.findByEmailWithPassword.mockResolvedValue(mockUser);
  mockUserRepo.incrementFailedAttempts.mockResolvedValue({ failedAttempts: 5 });
  mockBcrypt.compare.mockResolvedValue(false);

  await expect(authService.login({ ... })).rejects.toThrow(AuthenticationError);

  expect(mockUserRepo.lockAccount).toHaveBeenCalledWith(
    'user-1',
    expect.any(Date) // 30分後
  );
});
```

### 3. セッション最大延長期限
```typescript
it('セッション作成から8時間を超えると延長不可', async () => {
  const createdAt = new Date(Date.now() - 8 * 60 * 60 * 1000 - 1000); // 8時間1秒前
  const result = await sessionService.refreshSession('session-1', createdAt);
  expect(result).toBeNull();
});
```

---

## 検証方法

### テスト実行
```bash
# ユニットテスト
docker compose exec dev pnpm --filter api test -- admin-

# 結合テスト
docker compose exec dev pnpm --filter api test -- admin-auth.integration

# 全テスト
docker compose exec dev pnpm --filter api test
```

### カバレッジ確認
```bash
docker compose exec dev pnpm --filter api test:coverage
```

---

## 参考ファイル

- `apps/api/src/__tests__/unit/session.service.test.ts` - セッションテストパターン
- `apps/api/src/__tests__/integration/auth.integration.test.ts` - 認証結合テストパターン
- `apps/api/src/__tests__/integration/test-helpers.ts` - テストヘルパー
