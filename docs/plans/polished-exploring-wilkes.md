# H-2: セッション・リフレッシュトークンのハッシュ化

## Context

`RefreshToken`、`Session`、`AdminSession` の `token` フィールドがDBに平文保存されている。DB漏洩時にセッションハイジャックが可能になるリスクがある。

一方、`ApiToken`、`OAuthAccessToken`、`OAuthRefreshToken` は既にSHA-256ハッシュで保存されており、同じパターンを適用する。

## 方針

- DBには `tokenHash`（SHA-256 hex, 64文字）のみ保存
- クッキーには生トークンをそのまま保持（クライアント側の変更なし）
- 検証フロー: クッキーから生トークン → `hashToken()` → DBでハッシュ検索
- 既存の `hashToken()` 関数（`apps/api/src/utils/pkce.ts:72-74`）を再利用

---

## Phase 1: Prismaスキーマ + マイグレーション

### 1.1 スキーマ変更

**`packages/db/prisma/schema.prisma`**

3モデルの `token` → `tokenHash` に変更:

| モデル | 行 | 変更内容 |
|--------|-----|---------|
| RefreshToken | 267 | `token String @unique @db.VarChar(500)` → `tokenHash String @unique @map("token_hash") @db.VarChar(64)` |
| Session | 283 | 同上 |
| AdminSession | 1373 | 同上 |

`@@index` も `[token]` → `[tokenHash]` に変更。

### 1.2 マイグレーション

`prisma migrate dev --create-only` で生成後、データ変換SQLを追加:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 新カラム追加 → 既存データハッシュ化 → NOT NULL + UNIQUE制約 → 旧カラム削除
ALTER TABLE "refresh_tokens" ADD COLUMN "token_hash" VARCHAR(64);
UPDATE "refresh_tokens" SET "token_hash" = encode(digest("token"::bytea, 'sha256'), 'hex');
ALTER TABLE "refresh_tokens" ALTER COLUMN "token_hash" SET NOT NULL;
-- (sessions, admin_sessions も同様)
-- 旧token カラム・インデックスは最後に削除
```

---

## Phase 2: リポジトリ層（2ファイル）

### 2.1 `apps/api/src/repositories/session.repository.ts`

| 変更 | 行 |
|------|-----|
| `CreateSessionData.token` → `tokenHash` | 8 |
| `create()`: `token` → `tokenHash` | 25 |
| `findByToken()` → `findByTokenHash()`: `where: { token }` → `where: { tokenHash }` | 36-40 |
| `revokeByToken()` → `revokeByTokenHash()`: 同上 | 96-101 |

### 2.2 `apps/api/src/repositories/admin-session.repository.ts`

同様のパターンで `token` → `tokenHash`、メソッド名変更。

---

## Phase 3: サービス層（2ファイル）

### 3.1 `apps/api/src/services/session.service.ts`

- `hashToken` を `../utils/pkce.js` からインポート
- `getSessionByToken(token)`: 内部で `hashToken(token)` してから `findByTokenHash()` を呼ぶ
- `createSession()`: 型変更（`token` → `tokenHash`）に追従

### 3.2 `apps/api/src/services/admin/admin-session.service.ts`

- `hashToken` をインポート
- `createSession()`: `hashToken(token)` して `tokenHash` をDBに保存、生トークンはレスポンスのみ返却
- `validateSession()`: `hashToken(token)` → `findByTokenHash()` で検索
- `revokeSession()`: `hashToken(token)` → `revokeByTokenHash()`
- **`ValidatedAdminSession` インターフェースから `token` フィールドを削除**（DBにはハッシュしかないため）

---

## Phase 4: コントローラー + ミドルウェア（3ファイル）

### 4.1 `apps/api/src/controllers/auth.controller.ts`

- `hashToken` をインポート
- `refresh()` (行92-143): `findUnique({ where: { token } })` → `findUnique({ where: { tokenHash: hashToken(refreshToken) } })`、保存も `tokenHash` に
- `logout()` (行174-181): `updateMany` の `where` を `tokenHash` に
- `oauthCallback()` (行251-264): 保存時に `tokenHash` を使用

### 4.2 `apps/api/src/middleware/session.middleware.ts`

- `hashToken` をインポート
- 行20-21: `prisma.session.findUnique({ where: { token: refreshToken } })` → `where: { tokenHash: hashToken(refreshToken) }`

### 4.3 `apps/api/src/middleware/require-admin-role.ts`

- 行39: `token: session.token` → `token` (引数のクッキー値をそのまま使用)

```typescript
req.adminSession = {
  id: session.id,
  token,  // クッキーから取得した生トークン（session.token ではなく引数の token）
  createdAt: session.createdAt,
  expiresAt: session.expiresAt,
};
```

`express.d.ts:26` の `token: string` は「生トークン（クッキー値）」を表すため変更不要。

---

## Phase 5: テスト更新

### ユニットテスト

| ファイル | 主な変更 |
|----------|---------|
| `__tests__/unit/session.repository.test.ts` | `token` → `tokenHash`、メソッド名変更 |
| `__tests__/unit/admin-session.repository.test.ts` | 同上 |
| `__tests__/unit/admin-session.service.test.ts` | ハッシュ化確認、`ValidatedAdminSession` から `token` 削除 |
| `__tests__/unit/session.middleware.test.ts` | `where: { tokenHash }` に変更 |
| `__tests__/unit/auth.controller.test.ts` | `findUnique`/`updateMany` の `where` をハッシュに |
| `__tests__/unit/admin-auth.service.test.ts` | 変更最小限（内部でハッシュ化される） |
| `__tests__/unit/require-admin-role.middleware.test.ts` | `req.adminSession.token` がクッキー値であること確認 |

### 統合テスト

| ファイル | 主な変更 |
|----------|---------|
| `__tests__/integration/admin-auth.integration.test.ts` | DB検索を `tokenHash` に |
| `__tests__/integration/system-admin.integration.test.ts` | セッション作成で `tokenHash` を使用 |
| テストヘルパー（存在すれば） | `createTestSession` 等の `token` → `tokenHash` |

### Phase 6: 漏れ確認

`grep -r "\.token\b" apps/api/src/ --include="*.ts"` でSession/RefreshToken関連の `token` 参照を全件チェック。

---

## スコープ外

- `OrganizationInvitation.token` / `AdminInvitation.token`（招待リンク用、別用途）
- WebSocket認証（`apps/ws/`）: JWTアクセストークンを使用、セッション/リフレッシュトークン不使用
- MCP Server認証: APIトークン（既にハッシュ化済み）

---

## 検証方法

1. `docker compose exec dev pnpm build` — ビルド成功
2. `docker compose exec dev pnpm test` — 全テスト通過
3. マイグレーション適用: `docker compose exec dev pnpm -F @agentest/db db:migrate`
4. 手動確認: ログイン → セッション検証 → リフレッシュ → ログアウト
5. 管理者: ログイン → セッション延長 → ログアウト
6. DB確認: `SELECT token_hash FROM sessions LIMIT 5;` — 64文字hex文字列であること
