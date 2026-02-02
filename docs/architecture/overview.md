# システム全体像

## 概要

Agentest はテスト管理ツール SaaS です。テストケースの作成・管理、テスト実行の記録、レポート生成を提供します。

## システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         クライアント                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐                             │
│  │   Web App   │    │  Admin App  │                             │
│  │  (React)    │    │  (React)    │                             │
│  └──────┬──────┘    └──────┬──────┘                             │
└─────────┼──────────────────┼────────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   REST API  │    │  WebSocket  │    │ MCP Server  │◄────┐   │
│  │  (Express)  │    │    (ws)     │    │             │     │   │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │   │
└─────────┼──────────────────┼──────────────────┼────────────┼───┘
          │                  │                  │            │
          ▼                  ▼                  ▼            │
┌─────────────────────────────────────────────────────────────────┐
│                      Infrastructure                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ PostgreSQL  │    │    Redis    │    │    MinIO    │         │
│  │   (DB)      │    │  (Cache/PS) │    │  (Storage)  │         │
│  └──────┬──────┘    └──────┬──────┘    └─────────────┘         │
└─────────┼──────────────────┼───────────────────────────────────┘
          │                  │                               │
          │                  │   ┌─────────────────────────────────┐
          │                  │   │       AI クライアント            │
          │                  │   ├─────────────────────────────────┤
          │                  │   │  ┌─────────────────────────┐   │
          │                  │   │  │ Claude Desktop / MCP AI │───┘
          │                  │   │  └─────────────────────────┘   │
          │                  │   └─────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Batch Layer                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │ Cloud Scheduler │───▶│       Cloud Run Jobs                │ │
│  │  (cron)         │    │  (apps/jobs: バッチ処理)             │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
│                                      │                          │
│                          ┌───────────┼───────────┐              │
│                          ▼           ▼           ▼              │
│                    PostgreSQL     Redis       Stripe            │
└─────────────────────────────────────────────────────────────────┘
```

> **Note**: MCP Server は AI（Claude 等）に対してツールを提供するサーバーです。
> AI が MCP Client として接続し、テストケース操作などの機能を利用します。

### MCP Server 認証

MCP Server は Streamable HTTP トランスポートを使用し、Web App と同じ OAuth 認証を共有します。

| 項目 | 説明 |
|------|------|
| トランスポート | Streamable HTTP |
| 認証方式 | OAuth (GitHub/Google) → HttpOnly Cookie |
| エンドポイント | `POST /mcp` (リクエスト・レスポンスを単一エンドポイントで処理) |
| 認可 | 認証ユーザーの権限を継承 |

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────┐
│  MCP Client     │     │   Web App       │     │   API       │
│  (Claude等)     │     │                 │     │             │
└────────┬────────┘     └────────┬────────┘     └──────┬──────┘
         │                       │                     │
         │ 1. OAuth ログイン（ブラウザ経由）            │
         │──────────────────────▶│────────────────────▶│
         │                       │                     │
         │ 2. HttpOnly Cookie 設定                     │
         │◀──────────────────────│◀────────────────────│
         │                       │                     │
         │ 3. POST /mcp（Cookie 自動送信）             │
         │    Content-Type: application/json           │
         │    Accept: text/event-stream                │
         │─────────────────────────────────────────────▶│
         │                       │                     │
         │ 4. SSE ストリームでレスポンス               │
         │◀─────────────────────────────────────────────│
         └───────────────────────┴─────────────────────┘
```

## アプリケーション

| アプリ | 役割 | 技術スタック |
|--------|------|-------------|
| `apps/web` | ユーザー向け SPA | React 19, React Router 7 (Remix 統合版), Tailwind |
| `apps/admin` | 管理画面 | React 19, Tailwind |
| `apps/api` | REST API | Express 5, Prisma |
| `apps/ws` | リアルタイム通信 | ws, Redis Pub/Sub |
| `apps/mcp-server` | AI 連携（MCP Protocol + MCP Apps） | MCP Protocol, @modelcontextprotocol/ext-apps, Vite |
| `apps/jobs` | バッチ処理 | Cloud Run Jobs, Prisma |

## UI/ナビゲーション

### ヘッダー構成

| 要素 | 動作 | 説明 |
|------|------|------|
| [A] ロゴ | `/dashboard` へ遷移 | 常にダッシュボードへ移動 |
| テキスト部分 | コンテキストに応じて変化 | 下記参照 |

#### テキスト部分の表示ルール

| 現在のページ | 表示テキスト | リンク先 |
|-------------|-------------|---------|
| `/projects/:projectId` | プロジェクト名 | `/projects/:projectId` |
| `/test-suites/:testSuiteId` | プロジェクト名 | `/projects/:projectId` |
| `/executions/:executionId` | プロジェクト名 | `/projects/:projectId` |
| その他（ダッシュボード等） | Agentest | `/dashboard` |

### 関連コンポーネント

| ファイル | 役割 |
|---------|------|
| `apps/web/src/components/layout-parts/Header.tsx` | ヘッダーコンポーネント |
| `apps/web/src/hooks/useCurrentProject.ts` | 現在のプロジェクトコンテキスト取得 |

## 共有パッケージ

| パッケージ | 役割 |
|-----------|------|
| `packages/shared` | 型定義、バリデーション、エラークラス |
| `packages/db` | Prisma スキーマ、クライアント |
| `packages/auth` | OAuth, JWT, ミドルウェア |
| `packages/storage` | S3 互換ストレージ |
| `packages/ws-types` | WebSocket イベント型 (`apps/ws` と連携) - ExecutionEvent, LockEvent, DashboardEvent, TestSuiteUpdatedEvent, TestCaseUpdatedEvent, NotificationEvent 等 |
| `packages/ui` | 共通 UI コンポーネント |

## インフラストラクチャ

| サービス | 役割 | 本番環境 |
|---------|------|---------|
| PostgreSQL | メインデータベース | Cloud SQL / RDS |
| Redis | キャッシュ、Pub/Sub | Cloud Memorystore / ElastiCache |
| MinIO | ファイルストレージ | Cloud Storage / S3 |

## 通信フロー

### 認証フロー

```
User → Web App → API (/auth/github) → GitHub OAuth → API → JWT 発行 → HttpOnly Cookie 設定 → Web App
```

> **セキュリティ**: JWT は HttpOnly Cookie で管理。XSS 攻撃からトークンを保護し、SameSite=Strict で CSRF を防止。

### 管理者認証フロー

```
Admin → Admin App → API (/admin/auth/login) → メール/パスワード検証 → 2FA 検証（有効時） → セッション Cookie 設定 → Admin App
```

> **セキュリティ**: ユーザー認証とは独立したセッション管理。2FA（TOTP）対応、アカウントロック機能、監査ログ記録。

### リアルタイム更新フロー

```
User A が更新 → API → Redis Pub/Sub → WebSocket Server → User B に通知
```

### 通知フロー

```
イベント発生 → NotificationService →
  ├→ DB 保存 → Redis Pub/Sub → WebSocket → クライアント（リアルタイム表示）
  └→ メール送信（dev: Mailpit、本番: SMTP）
```

設定チェック優先順位: 組織設定 > ユーザー設定 > デフォルト（有効）

## 設定と環境変数

各サービス間の接続に必要な主要な環境変数:

| 変数名 | 用途 | 設定例 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 接続文字列 | `postgresql://user:pass@localhost:5432/agentest` |
| `REDIS_URL` | Redis 接続文字列 | `redis://localhost:6379` |
| `MINIO_ENDPOINT` | MinIO エンドポイント | `localhost:9000` |
| `JWT_SECRET` | JWT 署名キー | ランダム文字列 |
| `GITHUB_CLIENT_ID` | GitHub OAuth クライアント ID | GitHub で発行 |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth シークレット | GitHub で発行 |
| `SMTP_HOST` | メールサーバー | `mailpit`（dev）/ `smtp.sendgrid.net`（本番） |
| `SMTP_PORT` | SMTP ポート | `1025`（dev）/ `587`（本番） |
| `SMTP_FROM` | 送信元アドレス | `noreply@agentest.io` |
| `PAYMENT_GATEWAY` | 決済ゲートウェイ切替（`mock` / `stripe`） | `mock` |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名シークレット | - |
| `STRIPE_PUBLISHABLE_KEY` | Stripe 公開可能キー | - |
| `STRIPE_PRICE_PRO_MONTHLY` | PRO 月払いの Stripe Price ID | - |
| `STRIPE_PRICE_PRO_YEARLY` | PRO 年払いの Stripe Price ID | - |
| `VITE_PAYMENT_GATEWAY` | フロントエンド用ゲートウェイ切替 | `mock` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | フロントエンド用 Stripe 公開可能キー | - |

詳細は各アプリの `.env.example` を参照してください。

## スケーラビリティ

| コンポーネント | スケール方針 |
|---------------|-------------|
| `apps/api` | 水平スケール可能（ステートレス） |
| `apps/ws` | Redis Pub/Sub により複数インスタンス対応 |
| `apps/mcp-server` | 単一インスタンス推奨 |
| `apps/jobs` | Cloud Scheduler によるスケジュール実行（単一インスタンス） |
| PostgreSQL | 読み取りレプリカで読み込み分散 |
| Redis | Cluster モードで水平スケール |

## エラーハンドリング

### サービス間通信の障害時

- **API → DB 接続失敗**: リトライ後、503 エラーを返却
- **API → Redis 接続失敗**: キャッシュをスキップし、DB から直接取得
- **WebSocket 切断**: クライアント側で自動再接続（exponential backoff）
- **MCP Server 障害**: AI クライアント側でタイムアウト処理

### 共通エラーレスポンス形式

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## 関連ドキュメント

- [データベース設計](./database.md)
- [API 設計方針](./api-design.md)
- [システム構成図（詳細）](./diagrams/system-overview.md)
