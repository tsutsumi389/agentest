# 初回セットアップ

## 前提条件

| 必要なもの | バージョン | 確認コマンド |
|-----------|-----------|-------------|
| Docker Desktop | 最新版 | `docker --version` |
| Docker Compose | v2 | `docker compose version` |
| Git | 最新版 | `git --version` |

> **Note:** Node.js / pnpm のインストールは不要です。

## セットアップ手順

### 1. リポジトリをクローン

```bash
git clone https://github.com/your-org/agentest.git
cd agentest
```

### 2. 環境変数を設定

```bash
cp .env.example .env
```

`.env` を編集して必要な値を設定：

```env
# Database
DB_USER=agentest
DB_PASSWORD=agentest
DB_NAME=agentest

# Redis
REDIS_PASSWORD=agentest

# トークン暗号化（OAuthトークンのDB保存時に使用）
TOKEN_ENCRYPTION_KEY=dev-token-encryption-key-change-in-production

# メール認証（SMTP設定不要で始める場合は false に設定）
# REQUIRE_EMAIL_VERIFICATION=false

# OAuth（後で設定可）
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

```

### 3. Docker用シンボリックリンクを作成

```bash
cd docker && ln -s ../.env .env && cd ..
```

### 4. Docker を起動

```bash
cd docker
docker compose up -d
```

初回はイメージのビルドに数分かかります。

### 5. データベースをセットアップ

```bash
# 依存関係をインストール
docker compose exec dev pnpm install

# Prisma クライアント生成
docker compose exec dev pnpm --filter @agentest/db db:generate

# データベーススキーマを同期
docker compose exec dev pnpm --filter @agentest/db db:push

# 管理者ユーザーを作成
docker compose exec dev pnpm --filter @agentest/db db:seed:admin
```

> **Note:** テスト用データベース（agentest_test）は Docker 起動時に自動作成されます。テスト実行時にスキーマが自動同期されます。

管理者ログイン情報：
| 項目 | 値 |
|------|-----|
| Email | `admin@example.com` |
| Password | `password123` |

### 6. 動作確認

| サービス | URL | 確認内容 |
|---------|-----|---------|
| Web | http://localhost:3000 | ログイン画面 |
| API | http://localhost:3001/health | `{"status":"ok"}` |
| Admin | http://localhost:3003 | 管理画面 |
| MinIO | http://localhost:9001 | コンソール |

## トラブルシューティング

### ポートが使用中

```bash
# 使用中のポートを確認
lsof -i :3000

# プロセスを終了
kill -9 <PID>
```

### Docker のディスク容量不足

```bash
# 未使用のイメージ・コンテナを削除
docker system prune -a
```

### node_modules の同期問題

```bash
# ボリュームを削除して再起動
docker compose down -v
docker compose up -d

# 依存関係を再インストール
docker compose exec dev pnpm install
docker compose exec dev pnpm --filter @agentest/db db:generate
docker compose exec dev pnpm --filter @agentest/db db:push
```

## 次のステップ

- [開発フロー](./development.md)
- [テスト方針](./testing.md)
