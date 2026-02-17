# 開発フロー

## 日常の開発

### 起動

```bash
cd docker
docker compose up
```

バックグラウンド実行する場合：

```bash
docker compose up -d
```

### ログ確認

```bash
# 全サービス
docker compose logs -f

# 特定サービス
docker compose logs -f api
docker compose logs -f web
```

> **Note**: バックエンドサービスは Pino による構造化JSONログを出力します。開発時に可読形式で表示するには環境変数 `LOG_PRETTY=true` を設定してください。詳細は[ログ設定](#ログ設定)を参照。

### 停止

```bash
docker compose down
```

## pnpm コマンドの実行

ホストに pnpm がないため、コンテナ経由で実行します。

```bash
# dev コンテナを起動（初回のみ）
docker compose --profile tools up -d dev

# パッケージ追加
docker compose exec dev pnpm --filter @agentest/api add express

# 開発用パッケージ追加
docker compose exec dev pnpm --filter @agentest/web add -D vitest

# 全パッケージで実行
docker compose exec dev pnpm -r build
```

## ファイル編集

ホストの IDE でファイルを編集すると、自動的にコンテナに反映されます（ボリュームマウント）。

ホットリロード対応：
- `apps/web` - Vite HMR
- `apps/admin` - Vite HMR
- `apps/api` - tsx watch
- `apps/ws` - tsx watch

## MCP Apps開発

MCP Server には MCP Apps 機能が含まれており、AI クライアント内にインタラクティブ UI を表示できます。

### UIファイル構成

```
apps/mcp-server/src/apps/
├── index.ts              # Apps登録（registerApps関数）
├── types.ts              # 共通型定義
└── test-suites-app/      # テストスイート一覧App
    ├── index.html        # UIテンプレート
    └── app.ts            # UIロジック
```

### UIビルド

MCP Apps の UI は Vite + vite-plugin-singlefile で単一 HTML にバンドルされます。

```bash
docker compose exec dev pnpm --filter @agentest/mcp-server build:ui
```

ビルド出力先: `apps/mcp-server/dist/src/apps/test-suites-app/index.html`

### 開発時の注意点

1. **UI変更後**: `build:ui` を実行してHTMLを再生成
2. **型定義**: `apps/mcp-server/src/apps/types.ts` に共通型を定義
3. **ホットリロード未対応**: MCP Apps UI は開発時もビルドが必要

### 新しいAppの追加

1. `apps/mcp-server/src/apps/` に新しいディレクトリを作成
2. `index.html`（テンプレート）と `app.ts`（ロジック）を作成
3. `apps/mcp-server/src/apps/index.ts` に `registerAppTool` と `registerAppResource` を追加
4. `package.json` の `build:ui` スクリプトに新しいAppのビルドを追加

## メール送信テスト（Mailpit）

開発環境では Mailpit を使用してメール送信をテストできます。

### アクセス

| サービス | URL |
|---------|-----|
| Web UI | http://localhost:8025 |
| SMTP | localhost:1025 |

### 環境変数（apps/api）

```env
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=noreply@agentest.local
```

### 確認方法

1. 通知トリガー（組織招待など）を実行
2. http://localhost:8025 でメールを確認

Mailpit は送信されたメールを全てキャプチャし、Web UI で確認できます。実際のメール送信は行われません。

## ログ設定

バックエンドサービス（API, WS, Jobs, MCP Server）は [Pino](https://getpino.io/) を使用した構造化JSONログを出力します。

### ロガーの仕組み

共有ロガーパッケージ `@agentest/shared/logger` がベースとなり、各アプリがサービス別のロガーを生成します。

```typescript
// packages/shared/src/logger/index.ts で提供
import { createLogger, type Logger } from '@agentest/shared/logger';

// 各アプリの apps/*/src/utils/logger.ts で使用
export const logger: Logger = createLogger({ service: 'api' });
```

### child logger によるモジュール別コンテキスト

サービス内の各モジュールでは child logger を使用してコンテキストを追加します。

```typescript
import { logger as baseLogger } from '../utils/logger.js';
const logger = baseLogger.child({ module: 'events' });

// 出力: {"level":"info","time":"...","service":"api","module":"events","msg":"..."}
```

### ログレベル

| レベル | 用途 |
|--------|------|
| `fatal` | アプリケーション停止を伴う致命的エラー |
| `error` | エラー、例外 |
| `warn` | 警告（レート制限到達、廃止API使用など） |
| `info` | 重要イベント（起動、リクエスト、ユーザー操作） |
| `debug` | デバッグ情報（開発時のみ） |
| `trace` | 詳細トレース情報 |

デフォルトログレベルは環境に応じて自動設定されます。

| 環境 | デフォルトレベル |
|------|----------------|
| `production` | `info` |
| `development` | `debug` |
| `test` | `silent` |

`LOG_LEVEL` 環境変数で明示的に上書きできます。

### ログ記法

Pino の推奨パターンに従い、コンテキストをオブジェクトで、メッセージを文字列で渡します。

```typescript
// 正しいパターン
logger.info({ userId, action: 'login' }, 'ユーザーがログインしました');
logger.error({ err, requestId }, 'リクエスト処理に失敗しました');

// 避けるべきパターン
logger.info(`ユーザー ${userId} がログインしました`);  // コンテキストが構造化されない
```

### 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `LOG_LEVEL` | ログレベルの明示指定 | 環境に応じて自動判定 |
| `LOG_PRETTY` | `true` で pino-pretty による可読フォーマット | 未設定（JSON出力） |
| `NODE_ENV` | ログレベル自動判定に使用 | - |

### 新しいバックエンドアプリへのログ追加

1. `apps/<app>/src/utils/logger.ts` を作成:

```typescript
import { createLogger, type Logger } from '@agentest/shared/logger';
export const logger: Logger = createLogger({ service: '<app-name>' });
```

2. モジュール内で child logger を使用:

```typescript
import { logger as baseLogger } from '../utils/logger.js';
const logger = baseLogger.child({ module: '<module-name>' });
```

## ブランチ戦略

```
main
  └── develop
        ├── feature/xxx
        ├── fix/xxx
        └── refactor/xxx
```

### ブランチ命名規則

| プレフィックス | 用途 |
|--------------|------|
| `feature/` | 新機能 |
| `fix/` | バグ修正 |
| `refactor/` | リファクタリング |
| `docs/` | ドキュメント |
| `chore/` | 雑務（依存更新など） |

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) に従う：

```
<type>(<scope>): <subject>

<body>
```

例：

```
feat(api): add user authentication endpoint

- Implement GitHub OAuth flow
- Add JWT token generation
- Create auth middleware
```

### Type 一覧

| Type | 説明 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメント |
| `style` | コードスタイル |
| `refactor` | リファクタリング |
| `test` | テスト |
| `chore` | 雑務 |

## プルリクエスト

### 作成前チェックリスト

- [ ] `docker compose exec dev pnpm lint` が通る
- [ ] `docker compose exec dev pnpm test` が通る
- [ ] `docker compose exec dev pnpm build` が通る
- [ ] 必要なドキュメントを更新した

### PR テンプレート

```markdown
## 概要
何を変更したか

## 変更理由
なぜ変更が必要だったか

## テスト方法
どうやって動作確認したか

## スクリーンショット（UI 変更の場合）
```

## 関連ドキュメント

- [テスト方針](./testing.md)
- [デプロイ手順](./deployment.md)
