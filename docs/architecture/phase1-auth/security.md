# セキュリティ設計

## 概要

認証基盤のセキュリティは多層防御を採用。JWT + RefreshToken + Session の3層管理により、セキュリティと利便性のバランスを実現している。

---

## 1. 認証アーキテクチャ

### トークン構成

```
┌────────────────────────────────────────────────────────────────┐
│                       認証の3層構造                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │  Access Token   │  │  Refresh Token  │  │    Session     │ │
│  ├─────────────────┤  ├─────────────────┤  ├────────────────┤ │
│  │ 有効期限: 15分   │  │ 有効期限: 7日   │  │ 有効期限: 7日  │ │
│  │ 保存: Cookie    │  │ 保存: Cookie    │  │ 保存: DB       │ │
│  │ 用途: API認証   │  │ 用途: Token更新 │  │ 用途: 追跡     │ │
│  └─────────────────┘  └─────────────────┘  └────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 各トークンの役割

| トークン | 有効期限 | 保存場所 | 用途 |
|---------|---------|---------|------|
| Access Token | 15分 | HttpOnly Cookie | API リクエスト認証 |
| Refresh Token | 7日 | HttpOnly Cookie | Access Token の更新 |
| Session | 7日 | PostgreSQL | セッション追跡・管理 |

---

## 2. JWT 仕様

### ペイロード構造

```typescript
interface JwtPayload {
  sub: string      // ユーザー ID（UUID）
  email: string    // メールアドレス
  type: 'access' | 'refresh'
  iat: number      // 発行時刻（Unix タイムスタンプ）
  exp: number      // 有効期限（Unix タイムスタンプ）
}
```

### 署名アルゴリズム

| 項目 | 値 |
|------|-----|
| アルゴリズム | RS256（RSA-SHA256） |
| Access Token シークレット | `JWT_ACCESS_SECRET`（32文字以上） |
| Refresh Token シークレット | `JWT_REFRESH_SECRET`（32文字以上） |

### トークン生成

```typescript
// Access Token
jwt.sign(
  { sub: userId, email, type: 'access' },
  JWT_ACCESS_SECRET,
  { expiresIn: '15m' }
)

// Refresh Token
jwt.sign(
  { sub: userId, email, type: 'refresh' },
  JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
)
```

### トークン検証

```
1. JWT 署名検証
2. 有効期限チェック（exp > 現在時刻）
3. type フィールド検証
4. DB でトークン状態確認（失効チェック）
```

---

## 3. Cookie セキュリティ

### Cookie 属性

| 属性 | Access Token | Refresh Token | 説明 |
|------|-------------|---------------|------|
| HttpOnly | true | true | JavaScript からアクセス不可 |
| Secure | 本番: true | 本番: true | HTTPS のみ送信 |
| SameSite | Strict | Strict | 同一オリジンのみ送信 |
| Path | / | / | 全パスで有効 |
| Max-Age | 900 (15分) | 604800 (7日) | 有効期限 |

### Cookie 設定例

```
Set-Cookie: access_token=eyJhbGciOiJ...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
Set-Cookie: refresh_token=eyJhbGciOiJ...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```

### OAuth 連携追加時の例外

OAuth リダイレクトに対応するため、連携追加モードでは `SameSite=Lax` を使用:

```
Set-Cookie: oauth_link_mode={...}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=300
```

---

## 4. セッション管理

### セッション情報

| フィールド | 説明 |
|-----------|------|
| id | セッション ID（UUID） |
| userId | ユーザー ID |
| token | セッショントークン（RefreshToken と紐付け） |
| userAgent | ブラウザ・クライアント情報 |
| ipAddress | IP アドレス（IPv6 対応） |
| lastActiveAt | 最終アクティブ日時 |
| expiresAt | 有効期限 |
| revokedAt | 失効日時（null = 有効） |
| createdAt | 作成日時 |

### セッション有効性判定

```typescript
// 有効なセッション
revokedAt === null && expiresAt > Date.now()
```

### セッション追跡

```
リクエスト受信
    │
    ▼
refresh_token Cookie を取得
    │
    ▼
DB でセッション検索
    │
    ├─ 有効 ────────────────┐
    │  req.sessionId を設定  │
    │  lastActiveAt を更新   │
    │                       │
    └─ 無効 ────────────────┐
       req.sessionId = null │
```

### クライアント情報抽出

```typescript
// User-Agent
req.headers['user-agent']

// IP アドレス（プロキシ対応）
req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress
```

---

## 5. トークン更新（Refresh）

### 更新フロー

```
クライアント                     サーバー
    │                             │
    │  POST /api/auth/refresh     │
    │  Cookie: refresh_token=xxx  │
    │─────────────────────────────>│
    │                             │
    │                             │  1. refresh_token 取得
    │                             │  2. JWT 検証
    │                             │  3. DB でトークン状態確認
    │                             │  4. 古いトークン無効化
    │                             │  5. 古いセッション無効化
    │                             │  6. 新規トークン生成
    │                             │  7. 新規セッション作成
    │                             │
    │  Set-Cookie: access_token   │
    │  Set-Cookie: refresh_token  │
    │  { accessToken: xxx }       │
    │<─────────────────────────────│
```

### セキュリティ対策

| 対策 | 説明 |
|------|------|
| トークンローテーション | 更新時に古いトークンを無効化 |
| セッション再作成 | 更新時にセッションも再作成 |
| DB 状態確認 | メモリキャッシュに頼らず DB で確認 |

---

## 6. OAuth セキュリティ

### サポートプロバイダー

| プロバイダー | スコープ | 備考 |
|-------------|---------|------|
| GitHub | `user:email` | メールなしの場合は noreply アドレス |
| Google | `profile, email` | メール必須 |

### OAuth 連携追加モード

**Cookie ベースの状態管理:**
```json
// oauth_link_mode Cookie
{
  "provider": "github",
  "userId": "uuid"
}
```

**有効期限:** 5分（OAuth フロー完了に十分な時間）

### 連携追加時のチェック

```
1. 同じプロバイダーアカウントが別ユーザーに連携されていないか
2. 同じユーザー・プロバイダーの重複連携がないか
```

### OAuth 連携解除ルール

- 最低1つの OAuth 連携は必須
- 連携数 ≤ 1 の場合は解除不可

---

## 7. 認可（Authorization）

### リソースアクセス制御

| リソース | ルール |
|---------|--------|
| ユーザープロフィール | 自分自身のみ |
| セッション | 自分のセッションのみ |
| OAuth 連携 | 自分の連携のみ |
| 組織 | メンバーのみ |
| プロジェクト | オーナーまたはメンバー |

### 認可ミドルウェア

```typescript
// 認証必須
requireAuth(config)

// 認証任意
optionalAuth(config)

// 組織ロール必須
requireOrgRole(['OWNER', 'ADMIN'])

// プロジェクトロール必須
requireProjectRole(['OWNER', 'ADMIN', 'DEVELOPER'])
```

### 認可チェックフロー

```
リクエスト受信
    │
    ▼
JWT 検証（authenticate）
    │
    ▼
ユーザー取得（Prisma）
    │
    ▼
deletedAt チェック
    │
    ▼
リソース所有者チェック
    │
    ├─ 成功 ────┐
    │  処理継続  │
    │           │
    └─ 失敗 ────┐
       403 エラー │
```

---

## 8. セキュリティヘッダー

### 推奨ヘッダー

| ヘッダー | 値 | 説明 |
|---------|-----|------|
| X-Content-Type-Options | nosniff | MIME スニッフィング防止 |
| X-Frame-Options | DENY | クリックジャッキング防止 |
| X-XSS-Protection | 1; mode=block | XSS フィルタ有効化 |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | HTTPS 強制 |
| Content-Security-Policy | default-src 'self' | CSP 設定 |

---

## 9. CORS 設定

### 設定

```typescript
{
  origin: CORS_ORIGIN,           // 許可オリジン
  credentials: true,             // Cookie を含める
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```

### 環境変数

| 環境 | CORS_ORIGIN |
|------|-------------|
| 開発 | http://localhost:3000 |
| 本番 | https://app.agentest.com |

---

## 10. 脅威と対策

### XSS (Cross-Site Scripting)

| 脅威 | 対策 |
|------|------|
| Cookie 窃取 | HttpOnly 属性 |
| DOM 操作 | CSP ヘッダー |
| 入力値インジェクション | 入力値エスケープ |

### CSRF (Cross-Site Request Forgery)

| 脅威 | 対策 |
|------|------|
| 偽造リクエスト | SameSite=Strict Cookie |
| セッションハイジャック | CORS 設定 |

### セッション固定攻撃

| 脅威 | 対策 |
|------|------|
| セッション ID 固定 | ログイン時にセッション再生成 |
| トークンリプレイ | トークンローテーション |

### ブルートフォース攻撃

| 脅威 | 対策 |
|------|------|
| トークン推測 | 十分なエントロピー（UUID） |
| API 乱用 | レート制限 |

---

## 11. 監査ログ（今後の実装予定）

### 記録対象イベント

| イベント | 説明 |
|---------|------|
| LOGIN | ログイン成功 |
| LOGOUT | ログアウト |
| TOKEN_REFRESH | トークン更新 |
| SESSION_REVOKE | セッション無効化 |
| OAUTH_LINK | OAuth 連携追加 |
| OAUTH_UNLINK | OAuth 連携解除 |
| PROFILE_UPDATE | プロフィール更新 |
| ACCOUNT_DELETE | アカウント削除 |

### ログ内容

```typescript
interface AuditLog {
  id: string
  userId: string
  event: string
  ipAddress: string
  userAgent: string
  details: Record<string, unknown>
  createdAt: Date
}
```

---

## 12. セキュリティベストプラクティス

### シークレット管理

- JWT シークレットは 32 文字以上
- 本番環境では環境変数から取得
- シークレットはローテーション可能な設計

### トークン管理

- Access Token は短寿命（15分）
- Refresh Token は長寿命だが DB で管理
- トークン更新時は古いトークンを無効化

### セッション管理

- セッション情報を DB に保存
- 異常なセッションを検出可能
- ユーザーがセッションを管理可能

### データ保護

- 論理削除でデータ復旧可能
- 30日後に物理削除（予定）
- 個人情報の最小化

---

## 13. 環境別設定

### 開発環境

```
Secure Cookie: false
SameSite: Strict
CORS Origin: http://localhost:3000
```

### 本番環境

```
Secure Cookie: true
SameSite: Strict
CORS Origin: https://app.agentest.com
HSTS: 有効
```
