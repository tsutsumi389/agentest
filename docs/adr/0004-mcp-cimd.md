# ADR-0004: MCP クライアント識別に CIMD を採用（DCR と共存）

## ステータス

採用

## コンテキスト

MCP 仕様（2025-11 更新）で **CIMD（Client ID Metadata Document, draft-ietf-oauth-client-id-metadata-document-00）** がデフォルトのクライアント識別メカニズムに採用された。

CIMD は `client_id` を HTTPS URL とし、その URL から取得できる JSON メタデータでクライアントを自己記述させる方式で、事前の DCR（動的クライアント登録, RFC 7591）を不要にする。

これまで agentest は RFC 7591 DCR のみサポートしており、CIMD クライアントからの接続を受け入れられなかった。

選択肢:

1. **DCR のみ維持** — MCP 2025-11 仕様非準拠になる。CIMD クライアントは接続不能
2. **CIMD のみ採用** — 既存 DCR クライアント（既存実装・既存統合）と非互換
3. **CIMD と DCR を共存** — 互換性維持しつつ仕様準拠

## 決定

**CIMD と DCR を共存させる。** `client_id` の形状（HTTPS URL か UUID か）で経路を自動判別する。

### 実装方針

1. **AS Metadata に `client_id_metadata_document_supported: true` を広告**（`apps/api/src/services/oauth.service.ts`）
2. **`OAuthClient` テーブルを拡張**して両経路のクライアントを同一テーブルで管理
   - `isCimd`, `metadataUrl`, `metadataFetchedAt`, `metadataExpiresAt`, `metadataEtag`, `jwksUri` を追加
   - `client_id` 列を `VARCHAR(255)` → `VARCHAR(2048)` に拡張（CIMD URL を許容）
3. **authorize / token の起点で `resolveClient()` を呼ぶ**
   - HTTPS URL → CIMD 経路（キャッシュ参照 → 期限切れなら条件付きフェッチ → 検証 → upsert）
   - UUID → 既存 DCR 経路（`findClientByClientId()`）
4. **redirect_uri 検証を経路別に分岐**
   - DCR: `localhost` / `127.0.0.1` のみ許可
   - CIMD: メタデータ宣言の `redirect_uris` 集合と完全一致（任意ドメイン可）
5. **SSRF 対策を施した HTTP クライアント（`utils/safe-fetch.ts`）を導入**
6. **対称鍵を CIMD 経路で禁止**（`client_secret*` プロパティと `client_secret_*` auth method を拒否）

## 結果

### メリット

- **MCP 2025-11 仕様準拠**
  - CIMD 対応クライアント（Claude Code 等の最新実装）が事前登録なしで接続可能
  - `client_id_metadata_document_supported: true` の広告で仕様準拠を明示
- **既存統合の互換性維持**
  - DCR 経路は無変更（既存テスト・既存クライアントは無修正で動作）
  - スキーマ拡張は ADD COLUMN（nullable / default 付き）と ALTER COLUMN（長さ拡張のみ）のため既存行に影響なし
- **任意ドメインの redirect_uri をセキュアに許可**
  - メタデータ宣言値との完全一致検証で、CIMD クライアントが `https://example.com/callback` のようなドメインリダイレクトを安全に使える
  - DCR の `localhost` 制限は維持
- **対称鍵を排除**
  - 公開ドキュメントに秘密鍵を含めない原則を仕様レベルで担保

### デメリット / リスク

- **SSRF リスク**
  - 任意 URL からの fetch は本質的に SSRF を伴う
  - → `utils/safe-fetch.ts` でプライベート / メタデータ / CGNAT レンジ拒否、DNS rebinding 対策、サイズ・タイムアウト・リダイレクト上限を実装
- **キャッシュ整合性**
  - クライアント側のメタデータ更新が即座に反映されない可能性
  - → `Cache-Control` / `ETag` を尊重し、`If-None-Match` による条件付きリクエストで鮮度を維持
- **並行フェッチ重複**
  - 同一 `client_id` への同時 authorize で二重フェッチが起きうる
  - → プロセス内 in-flight Promise マップ + DB `upsert` で冪等化
- **clientId カラム長拡張**
  - 関連子テーブル（`oauth_authorization_codes`, `oauth_access_tokens`, `oauth_refresh_tokens`）の `client_id` 列も同時拡張が必要
  - btree インデックスの 2704 byte 上限に注意（VARCHAR(2048) 単独は許容範囲）

### 将来の拡張

- **`private_key_jwt` 対応**: `jwks_uri` をスキーマに用意済み。token endpoint auth method として導入する際に追加実装

### 関連ドキュメント

- [OAuth 2.1 API](../api/oauth.md)
- [OAuth 2.1 データベース設計](../architecture/database/oauth.md)
- [MCP 連携機能](../architecture/features/mcp-integration.md)
- 仕様: [draft-ietf-oauth-client-id-metadata-document-00](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)
