# MCPサーバー APIキー認証機能追加

## 概要
OAuth 2.1に対応していないcoding agent（Claude Code等）をサポートするため、MCPサーバーにAPIキー認証を追加する。

## 設計方針
- **ヘッダー**: `X-API-Key` ヘッダーを使用
- **認証優先順位**: OAuth Bearer Token → APIキー → Cookie JWT
- **スコープ**: フルアクセス（ユーザーと同等の権限）
- **既存モデル活用**: PrismaのApiTokenモデルを使用

## 実装計画

### Phase 1: API側 - APIキー検証エンドポイント

#### 1.1 APIトークンリポジトリ作成
**新規**: `apps/api/src/repositories/api-token.repository.ts`
- `findByHash(tokenHash)` - ハッシュからAPIキー検索
- `updateLastUsedAt(id)` - 最終使用日時更新
- `create(data)` - APIキー作成
- `revoke(id)` - APIキー失効
- `findByUserId(userId)` - ユーザーのAPIキー一覧

#### 1.2 APIトークンサービス作成
**新規**: `apps/api/src/services/api-token.service.ts`
- `validateToken(rawToken)` - トークン検証（MCP内部通信用）
- `createToken(params)` - APIキー作成（生トークンは一度だけ返却）
- `revokeToken(id, userId)` - APIキー失効
- `listTokens(userId)` - APIキー一覧

#### 1.3 内部API検証エンドポイント
**新規**: `apps/api/src/routes/internal.ts`にルート追加
```
POST /internal/api-token/validate
  - X-Internal-Api-Key認証
  - Body: { token: "agentest_..." }
  - Response: { valid, userId, scopes }
```

**新規**: `apps/api/src/controllers/api-token.controller.ts`

### Phase 2: MCP側 - APIキー認証ミドルウェア

#### 2.1 APIキー認証サービス
**新規**: `apps/mcp-server/src/services/api-key-auth.service.ts`
- API側の `/internal/api-token/validate` を呼び出し
- `agentest_` プレフィックスの検証
- 結果のキャッシュ（オプション）

#### 2.2 APIキー認証ミドルウェア
**新規**: `apps/mcp-server/src/middleware/api-key-auth.middleware.ts`
- `X-API-Key` ヘッダーからトークン抽出
- APIキー検証サービスを呼び出し
- `req.user` と `req.authType` を設定

#### 2.3 ハイブリッド認証ミドルウェア拡張
**修正**: `apps/mcp-server/src/middleware/oauth-auth.middleware.ts`
- `mcpHybridAuthenticate()` にAPIキー認証を追加
- 認証優先順位: OAuth → APIキー → Cookie JWT

#### 2.4 CORS設定更新
**修正**: `apps/mcp-server/src/app.ts`
- `Access-Control-Allow-Headers` に `X-API-Key` 追加

### Phase 3: WebUI - APIキー管理機能

#### 3.1 APIキー管理エンドポイント
**新規**: `apps/api/src/routes/api-tokens.ts`
```
POST   /api/api-tokens       - APIキー作成
GET    /api/api-tokens       - APIキー一覧
DELETE /api/api-tokens/:id   - APIキー失効
```

#### 3.2 WebUI画面
**新規**: `apps/web/app/routes/settings.api-keys.tsx`
- APIキー一覧表示（プレフィックス、名前、作成日、最終使用日）
- 新規作成ダイアログ（名前入力）
- 作成直後のトークン表示（一度のみ）
- 削除確認ダイアログ

### Phase 4: 型定義・テスト

#### 4.1 型定義拡張
**修正**: `apps/mcp-server/src/types/express.d.ts`
```typescript
interface Request {
  authType?: 'oauth' | 'api-key' | 'cookie';
}
```

#### 4.2 テスト
- `apps/api/src/__tests__/unit/api-token.service.test.ts`
- `apps/mcp-server/src/__tests__/unit/middleware/api-key-auth.middleware.test.ts`
- `apps/mcp-server/src/__tests__/integration/api-key-auth.integration.test.ts`

## 影響ファイル一覧

### 新規作成
| ファイル | 目的 |
|---------|------|
| `apps/api/src/repositories/api-token.repository.ts` | DB操作 |
| `apps/api/src/services/api-token.service.ts` | ビジネスロジック |
| `apps/api/src/controllers/api-token.controller.ts` | コントローラー |
| `apps/api/src/routes/api-tokens.ts` | ユーザー向けルート |
| `apps/mcp-server/src/services/api-key-auth.service.ts` | 検証サービス |
| `apps/mcp-server/src/middleware/api-key-auth.middleware.ts` | 認証ミドルウェア |
| `apps/web/app/routes/settings.api-keys.tsx` | 管理画面 |

### 修正
| ファイル | 変更内容 |
|---------|----------|
| `apps/api/src/routes/internal.ts` | 検証エンドポイント追加 |
| `apps/api/src/app.ts` | ルート登録 |
| `apps/mcp-server/src/middleware/oauth-auth.middleware.ts` | ハイブリッド認証拡張 |
| `apps/mcp-server/src/app.ts` | CORS設定 |
| `apps/mcp-server/src/types/express.d.ts` | authType追加 |

## APIキーフォーマット
```
agentest_<random_32_bytes_base64url>
```
- プレフィックス: `agentest_`（識別用）
- ボディ: 32バイトのランダム値（Base64URL）
- 保存: SHA-256ハッシュ値

## 使用方法（coding agent側）

### Claude Code設定例
```json
{
  "mcpServers": {
    "agentest": {
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "X-API-Key": "agentest_xxxxxxxxxxxxx",
        "X-MCP-Client-Id": "claude-code-user123",
        "X-MCP-Project-Id": "project-uuid"
      }
    }
  }
}
```

## 検証方法
1. APIキー作成: WebUIの設定画面から新規APIキーを作成
2. トークンコピー: 作成直後に表示される生トークンをコピー
3. MCP設定: coding agentのMCP設定にトークンを追加
4. 接続テスト: MCPツール呼び出しが正常に動作することを確認
5. ログ確認: APIキーの最終使用日時が更新されていることを確認

## セキュリティ考慮事項
- APIキーはSHA-256ハッシュで保存（生トークンは保存しない）
- 作成直後の1回のみ生トークンを表示
- 最終使用日時を記録（不正利用の検知に活用）
- 失効機能で即時無効化が可能
