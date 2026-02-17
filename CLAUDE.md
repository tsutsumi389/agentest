# Agentest

Coding Agent（Claude Code等）から使うテスト管理ツール（OSS）。MCPでAIと連携し、テストケース作成・実行を自動化。

## 技術スタック

- **Frontend**: React 19, React Router 7, Tailwind
- **Backend**: Express 5, Prisma, PostgreSQL
- **Infra**: Redis, MinIO, Docker（完全Docker開発）

## コマンド

```bash
# 起動・停止
cd docker && docker compose up      # 開発サーバー起動
docker compose down                  # 停止

# pnpmコマンド（コンテナ経由）
docker compose exec dev pnpm install
docker compose exec dev pnpm test
docker compose exec dev pnpm build
docker compose exec dev pnpm lint
```

## 構造

```
apps/
  admin/         # 管理者向けSPA
  api/           # REST API
  jobs/          # バッチ処理（Cloud Run Jobs）
  mcp-server/    # AI連携（MCP Protocol）
  web/           # ユーザー向けSPA
  ws/            # WebSocketサーバー
packages/
  auth/          # 認証（OAuth, JWT）
  db/            # Prismaスキーマ
  shared/        # 共通型・バリデーション
  storage/       # ファイルストレージ（S3/MinIO）
  ui/            # 共通UIコンポーネント
  ws-types/      # WebSocket型定義
```

## コーディング規約

- コードのコメントは日本語で記載する

## 詳細

- [アーキテクチャ](docs/architecture/overview.md)
- [開発ガイド](docs/guides/development.md)
- [API設計](docs/architecture/api-design.md)
