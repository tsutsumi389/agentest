# MCP サーバー CIMD 対応

## Context

MCP仕様（2025年11月更新）で **Client ID Metadata Document (CIMD, draft-ietf-oauth-client-id-metadata-document-00)** がデフォルトのクライアント識別メカニズムに採用された。CIMDはclient_idをHTTPS URLとし、そのURLから取得できるJSONメタデータでクライアントを自己記述させる方式で、事前のDCR（動的クライアント登録）を不要にする。

現在のagentestはRFC 7591 DCR のみサポートしており、CIMDクライアントからの接続を受け入れられない。MCP準拠性を担保しつつ既存DCRクライアントとの互換性を維持するため、CIMD対応を **Authorization Server (`apps/api`) 側** に追加する。MCPサーバー (`apps/mcp-server`) はProtected Resourceとしてメタデータ広告の更新のみ行う。

### 方針（確定済み）
1. **DCRと共存**：client_id が HTTPS URL なら CIMD、UUID 形式なら従来の DCR 経路で分岐
2. **HTTPS 任意ドメイン許可 + SSRF 対策**：プライベート/ループバック/メタデータサービス拒否、DNS rebinding対策、サイズ上限5KB
3. **`OAuthClient` テーブルに upsert**：既存スキーマを拡張しCIMD/DCRクライアントを同一テーブルで管理

## Approach

### 1. Authorization Server Metadata に CIMD 広告を追加
`apps/api/src/services/oauth.service.ts:57-72` の `getAuthorizationServerMetadata()` に `client_id_metadata_document_supported: true` を追加するのみ。既存DCRクライアントへの影響なし。

### 2. client_id 経路分岐
authorize / token の両エンドポイントの起点で `resolveClient(clientId)` を呼ぶ：
- **CIMD URL の場合**：キャッシュ鮮度（`metadataExpiresAt`）を見てヒットすれば返す。期限切れは `If-None-Match: <metadataEtag>` で条件付きフェッチ。304 なら `metadataFetchedAt`/`metadataExpiresAt` のみ更新。200 ならバリデーションを通して `OAuthClient` に upsert。
- **UUID の場合**：従来のDCR経路（`findClientByClientId`）そのまま。

認可コード発行直後の token 交換は通常キャッシュヒットする。

### 3. スキーマ拡張

`packages/db/prisma/schema.prisma` の `OAuthClient` に以下を追加（すべて nullable / default でADD COLUMNのみ、既存行に影響なし）：

| フィールド | 型 | 用途 |
|---|---|---|
| `isCimd` | `Boolean @default(false)` | 経路判別 |
| `metadataUrl` | `String? @db.VarChar(2048)` | = clientId URL |
| `metadataFetchedAt` | `DateTime?` | 最終フェッチ時刻 |
| `metadataExpiresAt` | `DateTime?` | Cache-Control から算出 |
| `metadataEtag` | `String? @db.VarChar(255)` | 条件付きリクエスト用 |
| `jwksUri` | `String?` | 将来の private_key_jwt 対応（保存のみ） |

`clientId` カラム長を `VarChar(255) → VarChar(2048)` に拡張。`OAuthAuthorizationCode.clientId` / `OAuthAccessToken.clientId` / `OAuthRefreshToken.clientId` も同時拡張（FK整合）。btree 2704 byte 上限に注意。

マイグレーションは「ADD COLUMN」と「ALTER COLUMN（長さ拡張）」を別ファイルで段階適用。

### 4. 新規ファイル構成（Express + Prisma + Pino の既存パターンに準拠）

```
apps/api/src/
├── services/
│   ├── oauth.service.ts            # 既存。resolveClient / AS Metadata を修正
│   └── cimd/
│       ├── cimd-url.ts             # client_id が CIMD URL かの判定 + URL要件検証（純粋関数）
│       ├── cimd-fetcher.ts         # HTTP fetch + SSRF + サイズ上限 + ETag + Cache-Control
│       ├── cimd-validator.ts       # メタデータJSONのzod検証 + CIMD固有ルール（純粋関数）
│       └── cimd-service.ts         # 上記を束ねてupsertまで。外部公開API
├── repositories/
│   └── oauth.repository.ts         # upsertCimdClient / touchCimdClient を追加
├── validators/
│   └── oauth.validator.ts          # client_id を z.union([uuid, cimdUrlSchema]) に緩和
├── utils/
│   └── safe-fetch.ts               # SSRF対策fetchラッパ（再利用可能）
└── config/env.ts                   # CIMD_MAX_BYTES, CIMD_FETCH_TIMEOUT_MS, CIMD_CACHE_TTL_SEC 追加
```

純粋関数と I/O を分離し、フェッチャーとバリデーターは単体テストで網羅。

### 5. SSRF 対策（`utils/safe-fetch.ts`）
1. URL 検証：`https:` 必須、`hash === ''`、`username/password === ''`、`pathname !== '/'`
2. `dns/promises.lookup(host, { all: true })` で全IPを取得
3. `ipaddr.js`（新規依存）で `private/loopback/linkLocal/uniqueLocal/multicast/broadcast/reserved/unspecified` を拒否。`169.254.0.0/16`（メタデータ）、`100.64.0.0/10`（CGNAT）を明示拒否
4. **DNS rebinding対策**：検証済みIPに `https.request({ host: ip, servername: hostname, headers: { Host: hostname } })` で接続。接続後の再解決を防ぐ
5. `AbortSignal.timeout(5000)`、`redirect: 'manual'` で最大3ホップ手動追跡（各ホップでSSRF再検査）
6. レスポンスストリームで5KB超を abort
7. Content-Type が `application/json` で始まることを確認

### 6. HTTP Cache-Control / ETag
- `Cache-Control: max-age=N` → `metadataExpiresAt = now + N`
- `no-store` → DB 保存はするが期限ゼロ（毎回再検証）
- ヘッダなし → env `CIMD_CACHE_TTL_SEC`（既定3600）
- `ETag` 保存、期限切れ時は `If-None-Match` で条件付きリクエスト
- 304: メタデータ本体は再利用、期限のみ更新
- 4xx/5xx: キャッシュせず。既存の有効メタデータがあればフォールバック使用（警告ログ）。404 は `isActive=false`

### 7. CIMD 固有バリデーション（`cimd-validator.ts`）
- メタデータJSON内 `client_id` プロパティとフェッチ URL の完全一致（仕様必須要件）
- `client_secret*` / `token_endpoint_auth_method in {client_secret_basic, client_secret_post, client_secret_jwt}` は拒否（対称鍵禁止）
- `redirect_uris` 必須・配列
- ドキュメントサイズは fetcher 側で担保

### 8. redirect_uri 検証の経路分岐
既存 `validateRedirectUri`（localhost のみ許可）は **DCR経路のみ適用**。CIMD経路ではメタデータ宣言の `redirect_uris` 集合と完全一致で許可する。これが CIMD が任意ドメイン redirect を安全に許す中核の仕組み。

### 9. 並行フェッチの重複抑止
同一 client_id への同時 authorize で二重フェッチが起きる。対策：
- プロセス内 `Map<string, Promise<Metadata>>` で in-flight promise を共有
- DB は Prisma `upsert(where: { clientId })` で冪等化
- フェッチはトランザクション外で実行し、最後の upsert のみ単一クエリ

### 10. AS Metadata と MCP Protected Resource Metadata
- `apps/api` の AS metadata に `client_id_metadata_document_supported: true` 追加
- `apps/mcp-server/src/routes/oauth-metadata.ts:14-21` は `authorization_servers` が AS URL を指しているので変更不要（クライアントはそのURLから AS Metadata を引いて CIMD サポートを知る）

## Critical Files

- `apps/api/src/services/oauth.service.ts` — resolveClient 追加、AS Metadata更新
- `apps/api/src/services/cimd/*` — 新規（fetcher/validator/service/url）
- `apps/api/src/repositories/oauth.repository.ts` — upsertCimdClient / touchCimdClient 追加
- `apps/api/src/validators/oauth.validator.ts` — client_id スキーマ緩和、redirect_uri経路分岐
- `apps/api/src/routes/oauth.ts` — authorize / token で resolveClient 呼び出し
- `apps/api/src/utils/safe-fetch.ts` — 新規（SSRF対策 fetch）
- `apps/api/src/config/env.ts` — CIMD 関連 env 追加
- `packages/db/prisma/schema.prisma:1045-1139` — OAuthClient 拡張、clientId 長拡張
- `packages/db/prisma/migrations/*` — ADD COLUMN と ALTER COLUMN を別マイグレーション
- `apps/api/package.json` — `ipaddr.js` 追加

## Reusable Existing Utilities

- Pino logger: `packages/shared/src/logger/index.ts` → `createLogger({ service: 'api' }).child({ module: 'cimd' })`
- Prisma 経由のリポジトリパターン: `apps/api/src/repositories/oauth.repository.ts` を拡張
- zod バリデーションは `validators/oauth.validator.ts` の既存パターンを踏襲
- 既存 `generateClientId()` / `createClient()` / `findClientByClientId()` は DCR 経路用にそのまま維持

## Verification

### ユニットテスト（`apps/api/src/__tests__/services/cimd/`）
- `cimd-url.test.ts`：URL判定（fragment / userinfo / path なし / http の拒否）
- `cimd-validator.test.ts`：client_id一致、対称鍵拒否、redirect_uris 必須
- `cimd-fetcher.test.ts`：`nock` / MSW でサイズ超過、タイムアウト、redirect ループ、304、非JSON、ETag 往復
- `safe-fetch.test.ts`：`dns/promises` モックで private IP / rebinding 拒否

### 統合テスト（`apps/api/src/__tests__/routes/oauth.cimd.test.ts`）
- supertest + Prisma test DB で CIMD URL を clientId にした authorize → consent → token の通し
- `GET /.well-known/oauth-authorization-server` に `client_id_metadata_document_supported: true`
- CIMD クライアントで redirect_uri がメタデータ宣言と一致する場合のみ authorize 成功

### リグレッション
- 既存 `oauth.test.ts`（DCR経路）が無変更で通ること
- 既存 MCP Inspector 接続シナリオが通ること

### E2E / 手動確認
- ローカル HTTPS サーバー（自己署名 + `NODE_EXTRA_CA_CERTS`）に mock CIMD ドキュメントを配置し MCP Inspector から接続
- `docker compose exec dev pnpm test --filter @agentest/api`
- `docker compose exec dev pnpm build` でビルド通過確認
- `docker compose exec dev pnpm lint` でリント通過確認

## Risks and Gotchas

1. **clientId カラム長拡張**：`OAuthAuthorizationCode` / `OAuthAccessToken` / `OAuthRefreshToken` の `clientId` も同時拡張必須。btree インデックスの2704 byte 上限を意識。
2. **並行フェッチ**：in-flight promise cache + DB upsert の二段で冪等化。
3. **フェッチ失敗時のauthorize挙動**：キャッシュがあればフォールバック、無ければ `error=invalid_client`。
4. **token_endpoint_auth_method='none' 固定**：当面 public client 前提で `none` のみ受け入れ。private_key_jwt 対応は将来タスク（スキーマには `jwksUri` を用意）。
5. **resource パラメータ（RFC 8707）**：CIMD 経路でも従来通り検証必要。
6. **ログの慎重さ**：Pino `child({ module: 'cimd' })` でフェッチURL・ステータス・キャッシュヒット/ミス・フェッチ時間を記録。SSRF ブロックは `warn`。メタデータ本体は PII の可能性があるのでログしない。
