# dev環境構築手順に管理者シードを追加

## 概要
dev環境の初回セットアップ手順に `db:seed:admin` コマンドを追加し、管理者ユーザーが自動的に作成されるようにする。

## 変更対象ファイル

### `docs/guides/getting-started.md`

「5. データベースをセットアップ」セクションに管理者シードの実行を追加。

#### 変更後のステップ5:

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

#### 補足説明を追加:

管理者ログイン情報を明記:
- Email: `admin@example.com`
- Password: `password123`

## 検証方法

1. ドキュメントの変更を確認
2. 実際に手順通りに実行して管理画面にログインできることを確認
   - http://localhost:3003/admin/login
   - Email: admin@example.com
   - Password: password123
