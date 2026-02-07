# コードレビュー指摘事項（構造化ログ基盤導入時に発見）

> `feature/prod-c-3` ブランチのレビューで発見された、Pino導入とは無関係の既存課題。
> 別タスクとして対応する。

## CRITICAL

### C-1: JWT_ACCESS_SECRETにproductionガードなし（WS）

- **ファイル:** `apps/ws/src/config.ts:16`
- **問題:** WebSocketサーバーのJWT秘密鍵にproduction判定がなく、本番でもデフォルト値が使われる可能性がある
- **修正案:**
```typescript
const isProduction = process.env.NODE_ENV === 'production';
JWT_ACCESS_SECRET: isProduction
  ? z.string().min(32)
  : z.string().min(32).default('development-access-secret-key-32ch'),
```

### C-2: INTERNAL_API_SECRETにproductionガードなし（MCP Server）

- **ファイル:** `apps/mcp-server/src/config/env.ts:33`
- **問題:** 内部API認証用シークレットにproductionガードがなく、デフォルト値で本番稼働する可能性がある
- **修正案:** `isProduction`ガードを追加

### C-3: JWT秘密鍵のisProduction判定がZodスキーマと乖離する可能性

- **ファイル:** `apps/mcp-server/src/config/env.ts:7,21-26`
- **問題:** `isProduction`が`process.env.NODE_ENV`を直接参照しており、Zodスキーマの`NODE_ENV`デフォルト値(`development`)と乖離する可能性
- **修正案:** スキーマパース後の値から`isProduction`を導出する

### C-4: HTMLメールテンプレートでXSS脆弱性

- **ファイル:** `apps/api/src/services/email.service.ts:243-245`, `apps/api/src/services/notification.service.ts:198-200`
- **問題:** ユーザー名等が未エスケープでHTMLに挿入される
- **修正案:** `escapeHtml`ユーティリティを作成し、テンプレート変数をエスケープ

### C-6: Redis KEYSコマンドを本番コードで使用

- **ファイル:** `apps/api/src/lib/redis-store.ts:521,929,1018`
- **問題:** `redis.keys(pattern)`はO(N)でRedis全体をブロックする。本番でレイテンシスパイクの原因になる
- **修正案:** `SCAN`コマンドのイテレータパターンに置き換え

---

## HIGH

### H-1: WebSocketチャンネル名のバリデーション・認可なし

- **ファイル:** `apps/ws/src/server.ts:172-202`
- **問題:** クライアントから送られたチャンネル名をバリデーション・認可チェックなしでサブスクライブする
- **修正案:** チャンネル名のフォーマット検証とユーザー権限チェックを追加

### H-2: WebSocketメッセージのスキーマバリデーションなし

- **ファイル:** `apps/ws/src/server.ts:107-139`
- **問題:** `JSON.parse`後に`as ClientMessage`でキャストのみ。ランタイムバリデーションなし
- **修正案:** Zodスキーマで`discriminatedUnion`によるバリデーションを追加

### H-3: mapStripeStatusが不明ステータスをACTIVEにデフォルト

- **ファイル:** `apps/jobs/src/jobs/subscription-sync.ts:25-38`, `apps/jobs/src/jobs/webhook-retry.ts:445-459,428-439`
- **問題:** Stripeの未知のステータス（`incomplete`, `paused`等）がACTIVEとして扱われ、課金エラーのリスク
- **修正案:** 警告をログ出力し、`PAST_DUE`等の安全なデフォルトに変更

### H-4: ポートバリデーションに範囲制約なし

- **ファイル:** `packages/shared/src/config/env.schema.ts:40-41`
- **問題:** `API_PORT`と`WS_PORT`に`.int().min(1).max(65535)`制約がない
- **修正案:** `z.coerce.number().int().min(1).max(65535).default(3001)` に変更

### H-5: redis-store.ts 1105行、大規模なコード重複

- **ファイル:** `apps/api/src/lib/redis-store.ts`
- **問題:** 汎用ヘルパー（`setCache`/`getCache`/`invalidateCache`）が定義済みなのに15+関数が同じパターンを手動で重複実装
- **修正案:** 全キャッシュ関数を汎用ヘルパーに統合し、ドメイン別にファイル分割

### H-6: test-case.service.ts 2039行

- **ファイル:** `apps/api/src/services/test-case.service.ts`
- **問題:** ファイルサイズが800行の基準を大幅に超過
- **修正案:** 子エンティティ操作（precondition, step, expectedResult CRUD）を別サービスに抽出

### H-7: Redisパブリッシャーのロジック重複

- **ファイル:** `apps/api/src/lib/events.ts`, `apps/api/src/lib/redis-publisher.ts`
- **問題:** 同一のlazy-initialization、接続管理、`publishEvent`ロジックが2ファイルで重複。Redis接続も2本
- **修正案:** 共有のRedisパブリッシャーファクトリに統合

### H-8: UUID生成ライブラリの不統一

- **ファイル:** 複数ファイル
- **問題:** `uuid`パッケージと`crypto.randomUUID()`が混在
- **修正案:** Node.js組み込みの`crypto.randomUUID()`に統一し、`uuid`依存を削除

### H-10: plan-distribution-aggregationジョブにテストなし

- **ファイル:** `apps/jobs/src/jobs/plan-distribution-aggregation.ts`（221行）
- **問題:** 複雑な集計ロジックを含むジョブにユニットテストがない
- **修正案:** `metrics-aggregation.test.ts`を参考にテストを作成

---

## MEDIUM

### M-1: CSRF middlewareにADMIN_FRONTEND_URLが未含有

- **ファイル:** `apps/api/src/middleware/csrf.middleware.ts:24-27`
- **修正案:** `env.ADMIN_FRONTEND_URL`をallowedOriginsに追加

### M-2: OAuth accessToken/refreshTokenが平文でDB保存

- **ファイル:** `apps/api/src/app.ts:148-153`
- **修正案:** アプリケーションレベルの暗号化を検討

### M-3: エラーメッセージの文字列比較（マジックストリング）

- **ファイル:** `apps/api/src/middleware/error-handler.ts:58`
- **修正案:** カスタムエラークラス（`FileTypeError`）を導入

### M-4: startExecutionメソッドが174行

- **ファイル:** `apps/api/src/services/test-suite.service.ts:626-800`
- **修正案:** スナップショット作成のヘルパーメソッドを抽出

### M-5: generateAdminInvitationEmailが166行

- **ファイル:** `apps/api/src/services/email.service.ts:112-278`
- **修正案:** HTMLテンプレートを別ファイルに分離

### M-6: モジュールレベルのmutable state（let publisher = null）

- **ファイル:** `apps/api/src/lib/events.ts:10`, `redis-publisher.ts:10`, `redis-store.ts:8`
- **修正案:** ファクトリ/クラスパターンによる明示的ライフサイクル管理

### M-7: サービスファイル10+件にテスト変更なし

- **ファイル:** csrf, email, execution, oauth, organization-subscription, organization, session, subscription, user-invoice, webhook
- **修正案:** ロギング動作の検証テストを追加

### M-8: syncChildEntitiesWithHistoryが216行

- **ファイル:** `apps/api/src/services/test-case.service.ts:1821-2037`
- **修正案:** エンティティタイプのメタデータに基づくヘルパーに抽出

### M-9: JSONボディパーサーのリミットが50MB

- **ファイル:** `apps/api/src/app.ts:49`
- **修正案:** デフォルトを1MBにし、アップロードルートのみ50MBに設定

### M-14: JWT期間フィールドが任意文字列を許容

- **ファイル:** `packages/shared/src/config/env.schema.ts:16-17`
- **修正案:** `z.string().regex(/^\d+[smhd]$/)`でバリデーション

### M-18: Webhookペイロードのasキャストでランタイムバリデーションなし

- **ファイル:** `apps/jobs/src/jobs/webhook-retry.ts:91`
- **修正案:** Zodバリデーションまたはタイプガードを追加

### M-19: sendUnauthorized関数がmiddleware 2ファイルで重複

- **ファイル:** `apps/mcp-server/src/middleware/api-key-auth.middleware.ts:68-82`, `oauth-auth.middleware.ts:70-84`
- **修正案:** 共通ユーティリティに抽出

### M-20: Date計算のmutationパターン（3箇所）

- **ファイル:** `apps/jobs/src/jobs/history-cleanup.ts:18-19`, `project-cleanup.ts:17-18`, `payment-event-cleanup.ts:17-18`
- **修正案:** `new Date(Date.now() - days * 86400000)`に変更

### M-21: TODOコメントにチケット参照なし

- **ファイル:** `apps/mcp-server/src/transport/streamable-http.ts:28-29`
- **修正案:** 対応するissueを作成してリンク

### M-22: history-cleanupでユーザー単位のtry-catchなし

- **ファイル:** `apps/jobs/src/jobs/history-cleanup.ts:41-106`
- **修正案:** project-cleanup.tsと同様にユーザー単位のtry-catchを追加

### M-23: BACKFILL_DAYS環境変数に上限バリデーションなし

- **ファイル:** `apps/jobs/src/jobs/metrics-backfill.ts:30-33`
- **修正案:** 1-365の範囲制約とNaN検証を追加

### M-24: closeServerが未初期化のwssを処理しない

- **ファイル:** `apps/ws/src/server.ts:351-358`
- **修正案:** `if (!wss) return Promise.resolve()`のガードを追加
