# Agentest 環境構築 実装計画

> **ステータス: ✅ 完了** (2025-12)

## 概要

`docs/plans/環境構築.md` に基づき、完全Docker開発環境のモノレポプロジェクトを構築する。

## 方針

- **実装順序**: Phase 1 から順番に全フェーズを実装
- **DBスキーマ**: 設計済みの全34テーブルを実装
- **開発方式**: 完全Docker開発（ホストにNode.js/pnpmをインストールしない）

## 実装結果

- ✅ Phase 1: モノレポ基盤構築 - 完了
- ✅ Phase 2: 共通パッケージ - 完了
- ✅ Phase 3: バックエンド - 完了
- ✅ Phase 4: フロントエンド - 完了
- ✅ Phase 5: Docker環境 - 完了
- ✅ Phase 6: 動作確認 - 完了

## 実装フェーズ

### Phase 1: モノレポ基盤構築

**作成するファイル:**
- `package.json` - ルート設定（packageManager フィールド含む）
- `pnpm-workspace.yaml` - ワークスペース定義（catalogs含む）
- `turbo.json` - Turborepo タスク設定
- `tsconfig.base.json` - TypeScript 共通設定（ES2023, Node22）
- `eslint.config.js` - ESLint 9+ flat config
- `.prettierrc` - Prettier 設定
- `.gitignore` - Git 除外設定（更新）
- `.nvmrc` - Node.js バージョン指定（22）
- `.npmrc` - pnpm セキュリティ設定
- `.dockerignore` - Docker ビルド除外設定
- `.env.example` - 環境変数テンプレート

**ディレクトリ構造:**
```
agentest/
├── apps/
│   ├── web/
│   ├── admin/
│   ├── api/
│   ├── ws/
│   └── mcp-server/
├── packages/
│   ├── shared/
│   ├── ui/
│   ├── db/
│   ├── auth/
│   ├── storage/
│   └── ws-types/
├── docker/
└── infrastructure/
    └── terraform/
```

---

### Phase 2: 共通パッケージ

#### 2.1 packages/shared
- 型定義（User, Organization, Project, TestCase, TestSuite, Execution）
- Zod バリデーションスキーマ
- エラークラス（AppError, ValidationError, AuthError）
- 環境変数スキーマ

#### 2.2 packages/db
- Prisma スキーマ（既存の34テーブル設計を統合）
  - 認証: User, Account, RefreshToken, Session
  - 組織: Organization, OrganizationMember, OrganizationInvitation, Project, ProjectMember, ProjectHistory
  - テストスイート: TestSuite, TestSuitePrecondition, TestSuiteHistory
  - テストケース: TestCase, TestCasePrecondition, TestCaseStep, TestCaseExpectedResult, TestCaseHistory
  - 実行: Execution, ExecutionSnapshot, ExecutionPreconditionResult, ExecutionStepResult, ExecutionExpectedResult, ExecutionEvidence
  - レビュー: ReviewComment, ReviewCommentReply
  - 課金: Subscription, Invoice, PaymentMethod
  - その他: AgentSession, EditLock, ApiToken, Notification, NotificationPreference, OrganizationNotificationSetting, AuditLog, UsageRecord
- クライアントエクスポート
- マイグレーション準備
- 参照ドキュメント: `docs/architecture/database/`

#### 2.3 packages/auth
- OAuth 設定（GitHub, Google）
- JWT 発行・検証
- 認証ミドルウェア

#### 2.4 packages/storage
- S3互換クライアント（MinIO対応）

#### 2.5 packages/ws-types
- WebSocket イベント型定義

#### 2.6 packages/ui
- 空の雛形（後回し可）

---

### Phase 3: バックエンド

#### 3.1 apps/api
- Express 5 アプリケーション
- ヘルスチェック（`/health`）
- 認証ルート（`/auth/github`, `/auth/google`, `/auth/me`）
- エラーハンドリングミドルウェア
- レート制限

#### 3.2 apps/ws
- ws ベース WebSocket サーバー
- Redis Pub/Sub 連携
- JWT 認証

---

### Phase 4: フロントエンド

#### 4.1 apps/web
- Vite + React 19 + TypeScript
- React Router 7
- Tailwind CSS（ダークモード）
- ログインページ
- 認証フック

#### 4.2 apps/admin
- 最小構成の管理画面

---

### Phase 5: Docker 環境

**作成ファイル:**
- `docker/docker-compose.yml` - 本番構成
- `docker/docker-compose.override.yml` - 開発用上書き
- `docker/Dockerfile.api`
- `docker/Dockerfile.ws`
- `docker/Dockerfile.web`
- `docker/Dockerfile.admin`
- `docker/nginx.conf`

**サービス:**
- db (PostgreSQL 16)
- redis (Redis 7)
- minio (MinIO)
- api
- ws
- web
- admin
- dev (pnpmコマンド実行用)

---

### Phase 6: 動作確認

- `docker compose up --build` で全サービス起動
- ヘルスチェック確認
- pnpm コマンドの動作確認

---

## 依存関係（pnpm-workspace.yaml catalogs）

```yaml
catalog:
  typescript: "^5.7.0"
  zod: "^3.24.0"
  react: "^19.0.0"
  express: "^5.0.0"
  prisma: "^6.0.0"
  vitest: "^2.0.0"
```

---

## 実行順序（詳細）

### Step 1: Phase 1 - モノレポ基盤
```
作成ファイル:
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.js
├── .prettierrc
├── .gitignore (更新)
├── .nvmrc
├── .npmrc
├── .dockerignore
├── .env.example
├── apps/.gitkeep
├── packages/.gitkeep
├── docker/.gitkeep
└── infrastructure/terraform/.gitkeep
```

### Step 2: Phase 2 - 共通パッケージ
```
packages/
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types/
│       ├── errors/
│       ├── config/
│       ├── validators/
│       └── utils/
├── db/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/schema.prisma (34テーブル)
│   └── src/
├── auth/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
├── storage/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
├── ws-types/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
└── ui/
    ├── package.json
    ├── tsconfig.json
    └── src/
```

### Step 3: Phase 3 - バックエンド
```
apps/
├── api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts
│       ├── app.ts
│       ├── config/
│       ├── controllers/
│       ├── services/
│       ├── repositories/
│       ├── routes/
│       ├── middleware/
│       └── __tests__/
└── ws/
    ├── package.json
    ├── tsconfig.json
    └── src/
```

### Step 4: Phase 4 - フロントエンド
```
apps/
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
└── admin/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
```

### Step 5: Phase 5 - Docker環境
```
docker/
├── docker-compose.yml
├── docker-compose.override.yml
├── Dockerfile.api
├── Dockerfile.ws
├── Dockerfile.web
├── Dockerfile.admin
└── nginx.conf
```

### Step 6: Phase 6 - 動作確認
- `docker compose up --build` で起動
- 各サービスのヘルスチェック確認
- pnpmコマンドの動作テスト

---

## 参照ドキュメント

- `docs/plans/環境構築.md` - 実装計画詳細
- `docs/architecture/overview.md` - システム全体像
- `docs/architecture/database/` - DB設計（34テーブル）
- `docs/architecture/api-design.md` - API設計方針
