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
```

> **Note:** テスト用データベース（agentest_test）は Docker 起動時に自動作成されます。テスト実行時にスキーマが自動同期されます。

### 6. 動作確認

| サービス | URL | 確認内容 |
|---------|-----|---------|
| Web | http://localhost:3000 | ログイン画面 |
| API | http://localhost:3001/health | `{"status":"ok"}` |
| Admin | http://localhost:3003 | 管理画面 |
| MinIO | http://localhost:9001 | コンソール |

### 7. 管理者アカウントを作成

ブラウザで http://localhost:3003 にアクセスすると、初回セットアップウィザードが表示されます。

フォームに以下の情報を入力して SUPER_ADMIN アカウントを作成してください：

| 項目 | 説明 |
|------|------|
| 名前 | 管理者の表示名（1〜100文字） |
| メールアドレス | ログインに使用するメールアドレス |
| パスワード | 下記のパスワード要件を満たすもの |

**パスワード要件:**

- 8文字以上
- 大文字を含む（A-Z）
- 小文字を含む（a-z）
- 数字を含む（0-9）
- 記号を含む（`!@#$%^&*()_+-=[]{}';:"|,.<>/?`）

セットアップ完了後、ログイン画面にリダイレクトされます。作成したメールアドレスとパスワードでログインしてください。

> **Note:** 初回セットアップは管理者ユーザーが0件の場合のみ実行できます。一度セットアップが完了すると、自動的にログイン画面にリダイレクトされます。

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
