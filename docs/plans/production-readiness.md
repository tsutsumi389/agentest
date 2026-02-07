# 本番運用に向けた改善計画

## 概要

コードベース全体を調査し、本番運用前に対応すべき改善点を洗い出した。
優先度は **CRITICAL（必須）> HIGH（強く推奨）> MEDIUM（推奨）> LOW（余裕があれば）** の4段階で分類する。

---

## 調査対象

| 領域 | 対象 |
|------|------|
| セキュリティ・認証 | packages/auth, middleware, OAuth 2.1, WebSocket認証, MCP認証 |
| エラーハンドリング・ログ | error-handler, logger, フロントエンドErrorBoundary, ヘルスチェック |
| データベース | Prismaスキーマ, インデックス, トランザクション, N+1, 接続プーリング |
| インフラ・デプロイ | Docker, CI/CD, Terraform, シークレット管理, リソース制限 |
| 監視・可観測性 | ログ基盤, メトリクス, トレーシング, アラート |

---

## CRITICAL（本番デプロイ前に必須）

### C-1: CI/CDパイプラインの構築

**現状**: `.github/workflows/` が存在しない。テスト・ビルド・デプロイの自動化がゼロ。

**対応内容**:
- GitHub Actionsワークフロー作成
  - `ci.yml`: lint, typecheck, unit/integration test（PR時）
  - `e2e.yml`: Playwright E2Eテスト（PR時）
  - `deploy-staging.yml`: ステージング自動デプロイ（mainマージ時）
  - `deploy-production.yml`: 本番デプロイ（手動トリガー or タグプッシュ）
- Prismaマイグレーションの自動実行（`prisma migrate deploy`）

**対象ファイル**: `.github/workflows/`（新規作成）

---

### C-2: プロセスレベルの例外ハンドラ追加 ✅ 対応済み

**現状**: ~~`process.on('unhandledRejection')` / `process.on('uncaughtException')` が未実装。キャッチされないPromise拒否でプロセスがサイレントにクラッシュする可能性がある。~~

**対応内容**:
- API, WS, MCP, Jobs の各エントリポイントに追加
- エラーログ記録後、graceful shutdownを実行

**実装詳細**:
- `uncaughtException` / `unhandledRejection` ハンドラをモジュールレベルで登録（起動中のエラーもカバー）
- 構造化JSON形式でエラーログを出力（timestamp, level, message, error/reason, stack）
- サーバーアプリ（API, WS, MCP）: `shutdownFn` 参照経由でgraceful shutdownを呼び出し、起動前は即座に `process.exit(1)`
- Jobsアプリ: ベストエフォートでリソースクリーンアップ後に `process.exit(1)`
- `isShuttingDown` フラグで重複シャットダウンを防止
- 例外起因のシャットダウンはexit code 1（プロセスマネージャが異常終了として検知可能）
- 全サーバーに強制終了タイムアウト（10秒、`.unref()` 付き）を設置

**対象ファイル**:
- `apps/api/src/index.ts`
- `apps/ws/src/index.ts`
- `apps/mcp-server/src/index.ts`
- `apps/jobs/src/index.ts`

---

### C-3: 構造化ログ基盤の導入

**現状**: `apps/api/src/utils/logger.ts` はconsole.*のラッパーのみ。コード内コメントにも「将来的にPino等に置き換え可能」と記載あり。本番運用では構造化ログとログ集約が必須。

**対応内容**:
- Pinoの導入（高性能JSON構造化ログ）
- リクエストID（既存のX-Request-ID）をログコンテキストに自動付与
- ログレベル制御（production: info以上、development: debug）
- `console.log` / `console.error` の全面置き換え
- ログ出力先: stdout（Cloud Runと親和性が高い）

**対象ファイル**:
- `apps/api/src/utils/logger.ts`（書き換え）
- `apps/api/src/middleware/request-logger.ts`（Pino HTTP統合）
- 各サービスのconsole.log呼び出し箇所（全面置き換え）

---

### C-4: 監視・エラートラッキングの導入

**現状**: Sentry、DataDog等の監視ツールが一切未導入。本番障害の検知・通知手段がない。

**対応内容**:
- **Sentry導入**（エラートラッキング）
  - API, Web, Admin, WS, MCP の全サービスに統合
  - ソースマップのアップロード（フロントエンド）
  - パフォーマンスモニタリング（トランザクション追跡）
- **アラート設定**
  - 5xxエラー率閾値
  - レスポンスタイム劣化
  - 未処理例外の即時通知

**対象ファイル**:
- 各 `package.json`（@sentry/* パッケージ追加）
- 各エントリポイント（Sentry.init）
- `apps/web/vite.config.ts`, `apps/admin/vite.config.ts`（ソースマップアップロード）

---

### C-5: Infrastructure as Code の実装

**現状**: `infrastructure/terraform/` に `.gitkeep` のみ。インフラが手動構築の状態。

**対応内容**:
- Terraform で以下を定義
  - Cloud SQL（PostgreSQL）
  - Cloud Memorystore（Redis）
  - Cloud Run（API, WS, MCP, Jobs）
  - Cloud Storage（Terraformステート + バケット）
  - Cloud Load Balancer + Cloud CDN
  - VPCネットワーク + ファイアウォール
  - Secret Manager
- 環境ごとのtfvars（staging, production）

**対象ファイル**: `infrastructure/terraform/`（新規作成）

---

### C-6: シークレット管理の本番対応

**現状**: 全シークレットが `.env` ファイルに格納。`docker/.env` にOAuth認証情報やStripeテストキーが平文で存在。

**対応内容**:
- GCP Secret Manager（または同等サービス）への移行
- Cloud Run でのシークレット注入設定
- `.env` から機密情報を除去し、`.env.example` をプレースホルダーのみに
- シークレットローテーションの手順書作成
- docker/.env が .gitignore に含まれていることの確認・徹底

**対象ファイル**:
- `docker/.env`（機密情報の除去）
- `.env.example`（プレースホルダーのみに）
- `infrastructure/terraform/`（Secret Manager定義追加）

---

## HIGH（本番デプロイ前に強く推奨）

### H-1: WebSocketトークンのURL露出対策

**現状**: `apps/ws/src/auth.ts:50` でクエリパラメータからトークンを取得。URLに含まれるトークンはアクセスログやプロキシログに記録される。

**対応内容**:
- 接続後の最初のメッセージでトークンを送信する方式に変更
- 既存の `authenticate` メッセージハンドラを初回認証にも適用
- クエリパラメータのトークン受付を廃止

**対象ファイル**:
- `apps/ws/src/auth.ts`
- `apps/ws/src/server.ts`
- `apps/web/src/` （WebSocket接続箇所）

---

### H-2: セッション・リフレッシュトークンのハッシュ化

**現状**: `packages/db/prisma/schema.prisma:267` でSessionモデルのtokenフィールドが平文保存。データベースが漏洩した場合、セッションハイジャックが可能。

**対応内容**:
- リフレッシュトークンをSHA-256でハッシュ化して保存
- セッショントークンも同様にハッシュ化
- 検証時はクライアントから受け取ったトークンをハッシュ化して比較

**対象ファイル**:
- `packages/auth/src/jwt.ts`
- `apps/api/src/services/session.service.ts`
- `apps/api/src/middleware/session.middleware.ts`

---

### H-3: Dockerリソース制限の設定

**現状**: docker-compose.yml にメモリ・CPU制限が未設定。OOMキルによる予期しないクラッシュのリスクがある。

**対応内容**:
- 本番用docker-compose（またはCloud Run設定）にリソース制限を追加
  - API: memory 512MB, CPU 1.0
  - WS: memory 256MB, CPU 0.5
  - MCP: memory 512MB, CPU 1.0
  - PostgreSQL: memory 1GB
  - Redis: memory 256MB
- Cloud Runの場合はサービスごとの`--memory`/`--cpu`設定

**対象ファイル**:
- `docker/docker-compose.yml`（リソース制限追加）
- Cloud Run デプロイ設定

---

### H-4: 分散レートリミッティングの実装

**現状**: `apps/api/src/middleware/rate-limiter.ts` はインメモリストア。複数インスタンスで動作する場合、レートリミットが各インスタンスで独立してしまう。

**対応内容**:
- `rate-limit-redis` パッケージを導入
- Redisバックエンドのレートリミットストアに切り替え
- 既存のlimiter設定（apiLimiter, authLimiter, strictLimiter等）をそのまま活用

**対象ファイル**:
- `apps/api/package.json`（rate-limit-redis追加）
- `apps/api/src/middleware/rate-limiter.ts`

---

### H-5: データベース接続プーリングの最適化

**現状**: Prismaのデフォルト接続プール（10接続）を使用。API, WS, MCP, Jobsの4サービスが同一DBに接続するため、接続数が不足する可能性がある。

**対応内容**:
- DATABASE_URLにconnection_limitパラメータを追加
- 本番環境ではPgBouncerの導入を検討
- サービスごとに適切な接続数を設定
  - API: 20（最も負荷が高い）
  - WS: 5（リアルタイム更新のみ）
  - MCP: 10
  - Jobs: 5（バッチ処理）

**対象ファイル**:
- `.env.example`（DATABASE_URLにconnection_limit追記）
- `docker/docker-compose.yml`（PgBouncer追加検討）

---

### H-6: トランザクションの不足箇所の修正

**現状**: 一部のマルチステップ操作で `prisma.$transaction()` が未使用。例: `apps/api/src/services/test-suite.service.ts:136-146` でhistory作成とentity更新が別々のクエリ。クラッシュ時に部分更新が発生する。

**対応内容**:
- 以下のサービスでトランザクション未使用箇所を修正
  - TestSuiteService: history + 本体更新
  - TestCaseService: history + 本体更新
  - その他、作成+関連レコード作成のパターン
- `prisma.$transaction()` でラップ

**対象ファイル**:
- `apps/api/src/services/test-suite.service.ts`
- `apps/api/src/services/test-case.service.ts`
- 関連するrepositoryファイル

---

### H-7: Admin SPAのErrorBoundary追加

**現状**: `apps/web/` にはErrorBoundaryが実装済みだが、`apps/admin/` には未実装。管理画面でレンダーエラーが発生すると白画面になる。

**対応内容**:
- `apps/web/src/components/ErrorBoundary.tsx` を参考にadmin用を作成
- `apps/admin/src/App.tsx` のルートに配置

**対象ファイル**:
- `apps/admin/src/components/ErrorBoundary.tsx`（新規作成）
- `apps/admin/src/App.tsx`

---

### H-8: MCP Dockerfile の作成

**現状**: `docker/docker-compose.yml:153` で `docker/Dockerfile.mcp` を参照しているが、ファイルが存在しない。

**対応内容**:
- `Dockerfile.api` を参考にMCPサーバー用のDockerfileを作成
- UIビルド（test-suites-app）のステップを含める

**対象ファイル**:
- `docker/Dockerfile.mcp`（新規作成）

---

## MEDIUM（本番後の早期改善を推奨）

### M-1: ファイルアップロードのマジックバイト検証

**現状**: `apps/api/src/config/upload.ts:69` でContent-Typeヘッダーのみでファイル種別を判定。MIMEタイプは偽装可能。

**対応内容**:
- `file-type` パッケージを導入し、ファイルのマジックバイト（先頭数バイト）で実際のファイル種別を検証
- Content-Typeとマジックバイトが不一致の場合はリジェクト
- ワイルドカードMIMEタイプ（`image/*`, `video/*`, `audio/*`）を具体的なサブタイプに制限

**対象ファイル**:
- `apps/api/package.json`（file-type追加）
- `apps/api/src/config/upload.ts`

---

### M-2: MCP トークン検証のキャッシュ

**現状**: `apps/mcp-server/src/middleware/oauth-auth.middleware.ts` でリクエスト毎にAPIへのトークンイントロスペクションを実行。レイテンシとAPI負荷の原因。

**対応内容**:
- Redisを使ったトークン検証結果のキャッシュ（TTL: トークン残存期間 or 最大5分）
- キャッシュヒット時はAPIコールをスキップ
- トークン無効化時のキャッシュ破棄メカニズム

**対象ファイル**:
- `apps/mcp-server/src/middleware/oauth-auth.middleware.ts`
- `apps/mcp-server/src/middleware/api-key-auth.middleware.ts`

---

### M-3: WebSocket Redis Pub/Subのエラーハンドリング

**現状**: `apps/ws/src/redis.ts:30-46` のpublish/subscribe操作にtry-catchがない。Redis障害時にWebSocketサーバーがクラッシュする可能性。

**対応内容**:
- publish/subscribe操作にtry-catchを追加
- エラー時はログ記録の上、gracefulに処理を継続
- Redis再接続ロジックの確認

**対象ファイル**:
- `apps/ws/src/redis.ts`

---

### M-4: リクエストトレーシングの拡充

**現状**: `apps/api/src/middleware/request-logger.ts` でX-Request-IDを生成しているが、サービス層やRedisイベント、WebSocket通信には伝搬されていない。

**対応内容**:
- AsyncLocalStorage（Node.js標準API）でリクエストコンテキストを伝搬
- loggerに自動的にrequestIdを付与
- Redis pub/subメッセージにrequestIdを含める
- WebSocketイベントにもrequestIdを付与

**対象ファイル**:
- `apps/api/src/middleware/request-logger.ts`
- `apps/api/src/utils/logger.ts`
- `apps/api/src/lib/redis-publisher.ts`
- `apps/api/src/lib/events.ts`

---

### M-5: API ドキュメントの自動生成

**現状**: OpenAPI/Swagger仕様が未生成。APIの仕様がコードを読まないと把握できない。

**対応内容**:
- `zod-openapi` または `@asteasolutions/zod-to-openapi` でZodスキーマからOpenAPI仕様を生成
- Swagger UIをAPI `/docs` エンドポイントで提供
- CI/CDでのAPI仕様変更検知

**対象ファイル**:
- `apps/api/package.json`
- `apps/api/src/routes/`（各ルートにOpenAPIアノテーション追加）

---

### M-6: Node.jsバージョンの統一

**現状**: API/WS/Web/Admin は Node 22-alpine、Jobs は Node 20-alpine を使用。バージョン不一致によるランタイム差異のリスク。

**対応内容**:
- `apps/jobs/Dockerfile` を Node 22-alpine に統一
- `.node-version` または `.nvmrc` をルートに配置

**対象ファイル**:
- `apps/jobs/Dockerfile`
- `.node-version`（新規作成）

---

### M-7: Prometheusメトリクスの導入

**現状**: カスタムメトリクスの収集・公開手段がない。パフォーマンス劣化やリソース不足の検知が困難。

**対応内容**:
- `prom-client` パッケージの導入
- `/metrics` エンドポイントの追加
- 基本メトリクス: HTTPリクエスト数/レスポンスタイム、DB接続プール使用率、Redis接続状態、WebSocket接続数
- GCPモニタリングまたはGrafana+Prometheusとの連携

**対象ファイル**:
- `apps/api/package.json`
- `apps/api/src/routes/metrics.ts`（新規作成）
- `apps/ws/src/`（WebSocket接続数メトリクス）

---

### M-8: PostgreSQL Row-Level Security (RLS) の検討

**現状**: マルチテナンシーはAPIレイヤーの認可ミドルウェアのみで制御。アプリケーションのバグにより他テナントのデータにアクセスするリスクがゼロではない。

**対応内容**:
- 主要テーブル（Organization, Project, TestSuite, TestCase等）にRLSポリシーを設定
- `current_setting('app.organization_id')` でのテナント分離
- PrismaからのRLS対応（`SET app.organization_id` をトランザクション先頭で実行）

**対象ファイル**:
- `packages/db/prisma/migrations/`（RLS用マイグレーション）
- `packages/db/src/client.ts`（RLSコンテキスト設定）

---

## LOW（余裕があれば対応）

### L-1: バンドルサイズ分析ツールの導入

**現状**: フロントエンドのバンドルサイズ分析ツールが未設定。パフォーマンスボトルネックの特定が困難。

**対応内容**:
- `rollup-plugin-visualizer` をVite設定に追加
- CI/CDでバンドルサイズレポートを生成
- サイズ閾値超過時の警告

**対象ファイル**: `apps/web/vite.config.ts`, `apps/admin/vite.config.ts`

---

### L-2: 負荷テストの導入

**現状**: パフォーマンステストの仕組みがない。

**対応内容**:
- k6 または Artillery での負荷テストシナリオ作成
- 主要API: 認証、テストスイートCRUD、テスト実行
- WebSocket接続の同時接続テスト
- CI/CDでのパフォーマンスリグレッション検知

**対象ファイル**: `tests/load/`（新規作成）

---

### L-3: APIトークンの有効期限強制

**現状**: `ApiToken.expiresAt` がnullable（無期限トークンが作成可能）。

**対応内容**:
- デフォルト有効期限の設定（例: 365日）
- 無期限トークンの作成禁止または管理者承認フロー
- 期限切れトークンの定期クリーンアップジョブ

**対象ファイル**:
- `apps/api/src/services/api-token.service.ts`
- `apps/api/src/routes/api-tokens.ts`

---

### L-4: セッションIPバインディング

**現状**: セッションにIPアドレスが記録されているが、後続リクエストでの検証に使われていない。

**対応内容**:
- セッション検証時にIPアドレスの変更を検知
- 大幅な変更時（地理的に異なるIP等）はセッション無効化または追加認証要求
- User-Agentの整合性チェックも追加

**対象ファイル**:
- `apps/api/src/middleware/session.middleware.ts`

---

### L-5: CSPポリシーの厳格化

**現状**: `apps/api/src/app.ts` のHelmet CSP設定で `'unsafe-inline'` がstyleSrcに許可されている。

**対応内容**:
- nonceベースまたはhashベースのCSPに移行
- `'unsafe-inline'` の除去
- TailwindCSSとの互換性テスト

**対象ファイル**: `apps/api/src/app.ts`

---

### L-6: シークレットローテーション機構

**現状**: JWTシークレットの変更にはサービス再起動が必要。ダウンタイムなしのローテーションができない。

**対応内容**:
- 新旧2つのシークレットを同時に受け付ける仕組み
- 段階的ローテーション手順の策定
- Secret Managerのバージョン機能との連携

**対象ファイル**:
- `packages/auth/src/config.ts`
- `packages/auth/src/jwt.ts`

---

## 実装ロードマップ

### Phase 1: 本番デプロイの最低要件（1-2週間）

| 順序 | ID | 項目 | 依存 |
|:----:|:---|:-----|:----:|
| 1 | C-2 | プロセスレベル例外ハンドラ | なし |
| 2 | C-3 | 構造化ログ基盤（Pino） | なし |
| 3 | C-6 | シークレット管理の本番対応 | なし |
| 4 | H-8 | MCP Dockerfile作成 | なし |
| 5 | H-2 | トークンハッシュ化 | なし |
| 6 | H-1 | WebSocketトークン修正 | なし |
| 7 | C-1 | CI/CDパイプライン構築 | C-3 |
| 8 | C-4 | 監視・エラートラッキング | C-3 |

### Phase 2: 本番運用の安定化（2-4週間）

| 順序 | ID | 項目 | 依存 |
|:----:|:---|:-----|:----:|
| 9 | C-5 | Infrastructure as Code | C-6 |
| 10 | H-3 | Dockerリソース制限 | C-5 |
| 11 | H-4 | 分散レートリミッティング | なし |
| 12 | H-5 | DB接続プーリング最適化 | なし |
| 13 | H-6 | トランザクション修正 | なし |
| 14 | H-7 | Admin ErrorBoundary | なし |
| 15 | M-6 | Node.jsバージョン統一 | なし |

### Phase 3: 運用品質の向上（4-8週間）

| 順序 | ID | 項目 | 依存 |
|:----:|:---|:-----|:----:|
| 16 | M-1 | ファイルアップロード検証強化 | なし |
| 17 | M-2 | MCPトークン検証キャッシュ | なし |
| 18 | M-3 | WS Redis エラーハンドリング | なし |
| 19 | M-4 | リクエストトレーシング拡充 | C-3 |
| 20 | M-5 | APIドキュメント自動生成 | なし |
| 21 | M-7 | Prometheusメトリクス | C-4 |
| 22 | M-8 | RLS検討・導入 | なし |

### Phase 4: 品質の継続改善（以降随時）

| ID | 項目 |
|:---|:-----|
| L-1 | バンドルサイズ分析 |
| L-2 | 負荷テスト導入 |
| L-3 | APIトークン有効期限強制 |
| L-4 | セッションIPバインディング |
| L-5 | CSPポリシー厳格化 |
| L-6 | シークレットローテーション |

---

## 現状の評価サマリー

| 領域 | 評価 | 主な強み | 主な課題 |
|------|:----:|----------|----------|
| 認証・認可 | ◎ | OAuth 2.1, PKCE, TOTP 2FA, RBAC | トークン平文保存, WS URL露出 |
| 入力バリデーション | ◎ | Zod全面採用, Prismaによるインジェクション防止 | MIMEタイプ偽装リスク |
| APIセキュリティ | ○ | Helmet, CORS, レートリミット, CSRF | 分散レートリミット未対応 |
| データベース | ◎ | 包括的インデックス, カスケード削除, 監査証跡 | トランザクション不足箇所, 接続プール |
| エラーハンドリング | ○ | 構造化エラークラス, ヘルスチェック | プロセスレベルハンドラ未実装 |
| ログ・監視 | △ | リクエストID, ヘルスチェック | console.*のみ, 監視ツールなし |
| インフラ | △ | マルチステージDockerビルド, 非rootユーザー | CI/CDなし, IaCなし, リソース制限なし |
| テスト | ○ | Vitest + Playwright, E2E環境構築済み | CIパイプライン未連携 |
| ドキュメント | ○ | アーキテクチャ, 運用ドキュメント充実 | APIドキュメント未自動生成 |

**総合評価: 75/100** — アプリケーションコードの品質は高いが、運用基盤（CI/CD, 監視, IaC）の整備が不足している。Phase 1の完了で本番デプロイ可能なレベルに到達する。
