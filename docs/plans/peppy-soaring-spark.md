# M-2: MCP トークン検証のキャッシュ

## Context

現在 `apps/mcp-server` ではリクエスト毎にAPIサーバーへのトークンイントロスペクション（OAuth Bearer Token）やAPIキー検証のHTTPリクエストを発行している。これはレイテンシとAPIサーバーへの負荷の原因となる。Redisを使ったキャッシュで、同一トークンの再検証時にAPIコールをスキップする。

## 方針

サービス層（`TokenIntrospectionService`, `ApiKeyAuthService`）にキャッシュロジックを追加する。ミドルウェアは変更不要。既存の `apps/api/src/lib/redis-store.ts` のパターン（ioredis, 遅延初期化, graceful degradation）を踏襲する。

## 変更ファイル

### 1. `apps/mcp-server/package.json` - ioredis依存追加
- `ioredis` を dependencies に追加（catalog で管理: v5.4.0）

### 2. `apps/mcp-server/src/config/env.ts` - REDIS_URL環境変数追加
- `REDIS_URL` をスキーマに追加（optional, `z.string().url().optional()`）

### 3. `apps/mcp-server/src/lib/redis.ts` - Redis クライアント（新規）
- 遅延初期化パターン（`apps/api/src/lib/redis-store.ts` の `getRedisClient()` に倣う）
- `getRedisClient()`: ioredis インスタンスの取得
- `closeRedis()`: グレースフルシャットダウン用

### 4. `apps/mcp-server/src/lib/token-cache.ts` - トークンキャッシュサービス（新規）
- キープレフィックス:
  - `mcp:token:oauth:<SHA-256ハッシュ>` — OAuth トークン検証結果
  - `mcp:token:apikey:<SHA-256ハッシュ>` — APIキー検証結果
- トークン値をそのままキーに使わず、SHA-256ハッシュを使用（セキュリティ対策）
- キャッシュ保存データ: 検証結果のJSON（userId, scopes, 有効/無効）
- TTL計算: `min(トークン残存期間, 300秒)` （OAuthの場合 `exp` から算出、APIキーは固定300秒）
- 無効トークン（`valid: false`）はキャッシュしない（ブルートフォース対策）
- 公開関数:
  - `getCachedTokenValidation(type, token)`: キャッシュ取得
  - `cacheTokenValidation(type, token, result, expSeconds?)`: キャッシュ保存
  - `invalidateTokenCache(type, token)`: キャッシュ破棄

### 5. `apps/mcp-server/src/services/token-introspection.service.ts` - キャッシュ統合
- `validateToken()` メソッドにキャッシュロジック追加:
  1. キャッシュ確認 → ヒットならAPIコールスキップ
  2. ミス時は従来通りAPIコール
  3. 有効な結果をキャッシュに保存（TTL: min(残存期間, 300秒)）

### 6. `apps/mcp-server/src/services/api-key-auth.service.ts` - キャッシュ統合
- `validateToken()` メソッドにキャッシュロジック追加:
  1. フォーマットチェック後、キャッシュ確認
  2. ミス時は従来通りAPIコール
  3. 有効な結果をキャッシュに保存（TTL: 300秒固定）

### 7. `apps/mcp-server/src/index.ts` - シャットダウン時のRedis切断
- `closeRedis()` をシャットダウンシーケンスに追加

### 8. テストファイル
- `apps/mcp-server/src/__tests__/unit/lib/token-cache.test.ts` — トークンキャッシュのユニットテスト
- `apps/mcp-server/src/__tests__/unit/services/token-introspection.service.test.ts` — キャッシュ統合テスト追加
- `apps/mcp-server/src/__tests__/unit/services/api-key-auth.service.test.ts` — キャッシュ統合テスト追加

## キャッシュ設計の詳細

```
キャッシュキー: mcp:token:oauth:<sha256(token)>
キャッシュ値: { userId: string, scopes: string[] }
TTL: min(exp - now, 300) 秒

キャッシュキー: mcp:token:apikey:<sha256(token)>
キャッシュ値: { userId: string, organizationId?: string, scopes: string[], tokenId: string }
TTL: 300秒
```

- Redis未設定時はキャッシュなしで動作（graceful degradation）
- キャッシュエラー時もAPIコールにフォールバック

## 検証方法

1. `docker compose exec dev pnpm --filter @agentest/mcp-server test` でユニットテスト実行
2. `docker compose exec dev pnpm build` でビルド確認
3. Docker環境で実際にMCPリクエストを送信し、2回目以降のレスポンスタイムが短縮されることを確認
