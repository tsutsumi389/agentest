# Handoff: Coder → Tester

## 実装概要
- 実装プラン: docs/plans/tranquil-bouncing-cake.md
- ブランチ: feature/mcp_oauth2_1

## 実装内容

### 新規ファイル

**データベース:**
- `packages/db/prisma/schema.prisma` - OAuthClient, OAuthAuthorizationCode, OAuthAccessTokenモデル追加

**APIサーバー:**
- `apps/api/src/utils/pkce.ts` - PKCEユーティリティ（code_challenge検証、トークン生成）
- `apps/api/src/validators/oauth.validator.ts` - OAuthリクエスト検証スキーマ
- `apps/api/src/repositories/oauth.repository.ts` - OAuthデータアクセス層
- `apps/api/src/services/oauth.service.ts` - OAuthビジネスロジック
- `apps/api/src/controllers/oauth.controller.ts` - OAuth処理コントローラー
- `apps/api/src/routes/oauth.ts` - OAuthルート定義

**MCPサーバー:**
- `apps/mcp-server/src/routes/oauth-metadata.ts` - Protected Resource Metadataエンドポイント
- `apps/mcp-server/src/middleware/oauth-auth.middleware.ts` - Bearer Token認証ミドルウェア
- `apps/mcp-server/src/services/token-introspection.service.ts` - トークンイントロスペクションサービス
- `apps/mcp-server/src/types/express.d.ts` - Express型拡張

### 変更ファイル
- `apps/api/src/config/env.ts` - `API_BASE_URL` 環境変数追加
- `apps/api/src/routes/index.ts` - OAuthルート追加、Authorization Server Metadata追加
- `apps/mcp-server/src/config/env.ts` - `MCP_SERVER_URL`, `AUTH_SERVER_URL` 環境変数追加
- `apps/mcp-server/src/app.ts` - OAuth Metadataルート追加、ハイブリッド認証ミドルウェア適用

## 追加エンドポイント

### APIサーバー (Authorization Server)
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/.well-known/oauth-authorization-server` | GET | Authorization Server Metadata |
| `/oauth/register` | POST | 動的クライアント登録 (RFC 7591) |
| `/oauth/authorize` | GET | 認可エンドポイント |
| `/oauth/authorize/consent` | POST | 同意承認エンドポイント |
| `/oauth/token` | POST | トークンエンドポイント |
| `/oauth/introspect` | POST | トークンイントロスペクション |
| `/oauth/revoke` | POST | トークン失効 |

### MCPサーバー (Resource Server)
| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/.well-known/oauth-protected-resource` | GET | Protected Resource Metadata |

## テスト観点

### ユニットテスト

**pkce.ts:**
- `computeCodeChallenge()`: 正しいS256ハッシュ計算
- `verifyCodeChallenge()`: 正常系、不一致、plain methodは拒否
- `generateAuthorizationCode()`, `generateAccessToken()`: ランダム性
- `hashToken()`: 一貫したハッシュ生成

**oauth.validator.ts:**
- `validateRedirectUri()`: localhost/127.0.0.1のみ許可、それ以外拒否
- `parseAndValidateScopes()`: 有効なスコープのみ返す

**oauth.repository.ts:**
- クライアント作成・検索
- 認可コード作成・検索・使用済みマーク
- アクセストークン作成・検索・失効

**oauth.service.ts:**
- `registerClient()`: 正常系、invalid_redirect_uri
- `validateAuthorizeRequest()`: 正常系、クライアント不在、redirect_uri不一致
- `issueAuthorizationCode()`: コード生成、DB保存
- `exchangeCodeForToken()`: 正常系、無効なcode、期限切れ、PKCE検証失敗
- `introspectToken()`: active true/false
- `revokeToken()`: 失効成功

### 結合テスト

**動的クライアント登録:**
- `POST /oauth/register` - 正常系 (201 Created)
- `POST /oauth/register` - invalid_redirect_uri
- `POST /oauth/register` - invalid_client_metadata

**認可フロー:**
- `GET /oauth/authorize` - 未認証ならログインページへリダイレクト
- `GET /oauth/authorize` - invalid_client
- `POST /oauth/authorize/consent` - 認可コード発行、リダイレクト
- `POST /oauth/authorize/consent` - 拒否 (access_denied)

**トークン発行:**
- `POST /oauth/token` - 正常系
- `POST /oauth/token` - invalid_grant (無効なcode)
- `POST /oauth/token` - PKCE検証失敗

**トークンイントロスペクション:**
- `POST /oauth/introspect` - active: true
- `POST /oauth/introspect` - active: false (期限切れ/失効)

**MCPサーバー認証:**
- Bearer Token認証成功
- Bearer Token認証失敗（401 + WWW-Authenticate）
- Cookie認証フォールバック

## 注意事項

1. **テスト実行前の準備**:
   - `docker compose exec dev pnpm --filter @agentest/db db:push` でスキーマ適用済み
   - Prismaクライアント生成済み

2. **環境変数**:
   - APIサーバー: `API_BASE_URL` (デフォルト: `http://localhost:3001`)
   - MCPサーバー: `MCP_SERVER_URL` (デフォルト: `http://localhost:3002`), `AUTH_SERVER_URL` (デフォルト: `http://localhost:3001`)

3. **フロントエンド同意画面**:
   - 計画書では `apps/web/src/pages/oauth/consent.tsx` が必要とされているが、今回のスコープ外
   - 認可エンドポイントは同意画面URLへリダイレクトする実装

4. **ハイブリッド認証**:
   - MCPサーバーはBearer Token認証とCookie認証の両方をサポート
   - Bearer Tokenがあればそれを優先、なければ既存のCookie認証にフォールバック
