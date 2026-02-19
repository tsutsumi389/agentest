# Agentest

Coding Agent（Claude Code, Codex CLI, GitHub Copilot, Gemini CLI 等）から使うことに特化したテスト管理ツール。MCP（Model Context Protocol）でAIエージェントと連携し、テストケースの作成・管理・実行を効率化します。

## 主な機能

- **MCP 連携**: AI エージェントからテストケースの作成・取得・更新・削除が可能
- **テスト管理**: テストスイート・テストケースの作成・編集・履歴管理
- **テスト実行**: テスト実行と結果の記録・エビデンス管理
- **レビュー**: テストスイート・テストケースへのレビューコメント
- **リアルタイム更新**: WebSocket によるリアルタイム通知・同時編集制御
- **組織管理**: チーム利用のための組織・プロジェクト・メンバー管理
- **監査ログ**: 操作履歴の記録・閲覧・エクスポート

## クイックスタート

### 前提条件

- Docker / Docker Compose

### 起動

```bash
git clone https://github.com/agentest/agentest.git
cd agentest/docker
docker compose up
```

起動後、以下の URL にアクセスできます:

| サービス | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| Admin App | http://localhost:3003 |
| API | http://localhost:3001 |

初回アクセス時に `http://localhost:3003` で管理者アカウントを作成してください。

### MCP 連携の設定

Claude Code 等の MCP クライアントで以下のように設定します:

```json
{
  "mcpServers": {
    "agentest": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "X-API-Key": "<your-api-key>"
      }
    }
  }
}
```

API キーは Web App の設定画面から発行できます。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | React 19, React Router 7, Tailwind CSS |
| バックエンド | Express 5, Prisma ORM |
| データベース | PostgreSQL |
| キャッシュ | Redis |
| ストレージ | MinIO (S3 互換) |
| AI 連携 | MCP Protocol |
| インフラ | Docker Compose |

## プロジェクト構成

```
apps/
  admin/         # 管理者向け SPA
  api/           # REST API
  jobs/          # バッチ処理
  mcp-server/    # AI 連携（MCP Protocol）
  web/           # ユーザー向け SPA
  ws/            # WebSocket サーバー
packages/
  auth/          # 認証（OAuth, JWT）
  db/            # Prisma スキーマ
  shared/        # 共通型・バリデーション
  storage/       # ファイルストレージ（S3/MinIO）
  ui/            # 共通 UI コンポーネント
  ws-types/      # WebSocket 型定義
```

## ドキュメント

- [システムアーキテクチャ](docs/architecture/overview.md)
- [開発ガイド](docs/guides/development.md)
- [デプロイ手順](docs/guides/deployment.md)
- [API リファレンス](docs/api/README.md)
- [トラブルシューティング](docs/guides/troubleshooting.md)

## 開発

```bash
cd docker
docker compose up                    # 開発サーバー起動
docker compose exec dev pnpm test    # テスト実行
docker compose exec dev pnpm build   # ビルド
docker compose exec dev pnpm lint    # Lint
```

## コントリビューション

コントリビューションを歓迎します。詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT License](LICENSE)
