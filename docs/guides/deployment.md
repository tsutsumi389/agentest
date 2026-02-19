# デプロイ手順

## 概要

Agentest は Docker Compose を使用してセルフホスト環境にデプロイできます。

## 前提条件

- Docker および Docker Compose がインストール済み
- 最低 2GB のメモリ
- ポート 3000, 3001, 3002, 3003, 5432, 6379 が利用可能

## クイックスタート

### 1. リポジトリのクローン

```bash
git clone https://github.com/tsutsumi389/agentest.git
cd agentest
```

### 2. 環境変数の設定

```bash
cp docker/.env.example docker/.env
```

主要な環境変数:

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `DATABASE_URL` | Yes | PostgreSQL 接続文字列 |
| `REDIS_URL` | Yes | Redis 接続文字列 |
| `JWT_SECRET` | Yes | JWT 署名キー（ランダム文字列） |
| `TOKEN_ENCRYPTION_KEY` | Yes | OAuthトークン暗号化キー（32バイト以上） |
| `TOTP_ENCRYPTION_KEY` | Yes | TOTP秘密鍵暗号化キー（64文字hex） |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth クライアント ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth シークレット |
| `GOOGLE_CLIENT_ID` | No | Google OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth シークレット |
| `SMTP_HOST` | No | メールサーバー |
| `SMTP_PORT` | No | SMTP ポート |
| `SMTP_FROM` | No | 送信元アドレス |
| `REQUIRE_EMAIL_VERIFICATION` | No | メール認証の要否（デフォルト: `true`、`false` でスキップ） |

> **Note**: OAuth プロバイダーの環境変数が未設定の場合、該当のOAuth認証ボタンはUIから自動的に非表示になります。

### 3. 起動

```bash
cd docker
docker compose up -d
```

### 4. マイグレーション

```bash
docker compose exec dev pnpm --filter @agentest/db prisma migrate deploy
```

### 5. 初回セットアップ

ブラウザで `http://localhost:3003` にアクセスし、管理者アカウントを作成します。

## サービス構成

| サービス | ポート | 説明 |
|---------|--------|------|
| Web App | 3000 | ユーザー向け SPA |
| API | 3001 | REST API |
| WebSocket | 3002 | リアルタイム通信 |
| Admin App | 3003 | 管理画面 |
| PostgreSQL | 5432 | データベース |
| Redis | 6379 | キャッシュ / Pub/Sub |
| MinIO | 9000/9001 | ファイルストレージ |
| Mailpit | 8025 | メール確認（開発用） |

## バッチジョブ

`apps/jobs` はバッチ処理用アプリケーションです。cron やタスクスケジューラで定期実行します。

### ジョブ一覧

| ジョブ名 | 推奨スケジュール | 説明 |
|---------|-----------------|------|
| `history-cleanup` | 毎日 3:00 | 古い履歴の削除（30日超過） |
| `project-cleanup` | 毎日 4:00 | ソフトデリート済みプロジェクトの物理削除 |

### 手動実行

```bash
docker compose exec dev JOB_NAME=history-cleanup pnpm --filter @agentest/jobs start
```

### cron 設定例

```bash
# crontab -e
0 3 * * * cd /path/to/agentest/docker && docker compose exec -T dev JOB_NAME=history-cleanup pnpm --filter @agentest/jobs start
0 4 * * * cd /path/to/agentest/docker && docker compose exec -T dev JOB_NAME=project-cleanup pnpm --filter @agentest/jobs start
```

## マイグレーション

```bash
# マイグレーション適用
docker compose exec dev pnpm --filter @agentest/db prisma migrate deploy

# マイグレーション状態確認
docker compose exec dev pnpm --filter @agentest/db prisma migrate status
```

## ビルド

```bash
docker compose exec dev pnpm build
```

## バックアップ

### データベース

```bash
# バックアップ
docker compose exec db pg_dump -U agentest agentest > backup.sql

# リストア
docker compose exec -T db psql -U agentest agentest < backup.sql
```

### MinIO

MinIO のデータは Docker ボリュームに保存されています。ボリュームのバックアップを取得してください。

## セキュリティ推奨事項

- 本番環境では `JWT_SECRET`、`TOKEN_ENCRYPTION_KEY`、`TOTP_ENCRYPTION_KEY` に十分に強力なランダム値を使用してください
- HTTPS を有効にしてください（リバースプロキシの利用を推奨）
- `REQUIRE_EMAIL_VERIFICATION=true`（デフォルト）を本番環境で使用してください
- 定期的にバックアップを取得してください

## 関連ドキュメント

- [システム全体像](../architecture/overview.md)
- [開発フロー](./development.md)
- [トラブルシューティング](./troubleshooting.md)
