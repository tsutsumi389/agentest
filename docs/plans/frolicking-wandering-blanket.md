# M-2: OAuth accessToken/refreshToken の暗号化

> **ステータス**: 完了 (2026-02)

## Context

`Account` モデル（GitHub/Google OAuth連携）の `accessToken` / `refreshToken` が平文でDBに保存されている。
DBが侵害された場合、外部プロバイダーへの不正アクセスに利用される可能性がある。

**注意**: OAuth 2.1 Authorization Server側のトークン（`OAuthAccessToken` / `OAuthRefreshToken`）はすでにSHA-256ハッシュで保存されており、対象外。

## 方針

AES-256-GCM による対称暗号化を導入し、トークンを暗号化してDB保存する。
- ハッシュではなく暗号化（復号可能）を選択 → 将来GitHub/Google APIを呼ぶ可能性を考慮
- 暗号化キーは環境変数 `TOKEN_ENCRYPTION_KEY` で管理

## 変更対象ファイル

### 1. 暗号化ユーティリティの作成
**新規**: `apps/api/src/utils/crypto.ts`

```typescript
// AES-256-GCM による暗号化/復号
export function encrypt(plaintext: string, key: string): string
export function decrypt(ciphertext: string, key: string): string
```

- 形式: `iv:authTag:ciphertext` （Base64エンコード、コロン区切り）
- IV: 12バイトのランダム値（毎回生成）
- AuthTag: 16バイト（GCMの改ざん検知）
- キー: 環境変数から取得した32バイト以上の文字列をSHA-256でハッシュして使用

### 2. 環境変数の追加
**変更**: `apps/api/src/config/env.ts`

- `TOKEN_ENCRYPTION_KEY` を追加（本番必須、開発時はデフォルト値）

### 3. トークン保存時の暗号化
**変更**: `apps/api/src/controllers/auth.controller.ts` (L322-330)

- `profile.accessToken` / `profile.refreshToken` を `encrypt()` して保存

### 4. トークン読み出し時の復号
**変更**: `apps/api/src/repositories/account.repository.ts`

- `findByUserIdAndProvider`, `findByProviderAccountId` で取得したトークンを `decrypt()` して返す

### 5. テスト
**新規**: `apps/api/src/__tests__/unit/crypto.test.ts`

- encrypt/decrypt のラウンドトリップ
- 異なるIVで同じ平文が異なる暗号文になること
- 不正な暗号文での復号失敗
- null/undefinedトークンのハンドリング

**変更**: `apps/api/src/__tests__/unit/account.repository.test.ts` - 復号処理のテスト追加

### 6. Docker環境変数
**変更**: `docker/docker-compose.yml` （または `.env`）に `TOKEN_ENCRYPTION_KEY` 追加

## 検証方法

1. `docker compose exec dev pnpm test --filter=api` でユニットテスト通過
2. `docker compose exec dev pnpm build` でビルド成功
3. OAuth連携フロー（GitHub/Google）の動作確認（手動）
