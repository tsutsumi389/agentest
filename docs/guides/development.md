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
