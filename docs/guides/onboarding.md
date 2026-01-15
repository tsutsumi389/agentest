# オンボーディングガイド

新しくAgentestの開発チームに参加するメンバー向けのガイドです。

## 1. はじめに

Agentestへようこそ！このガイドでは、開発を始めるために必要な情報をまとめています。

### 1.1 Agentestとは

Agentestは、Coding Agent（Claude Code等）と連携するテスト管理ツールSaaSです。

**主な特徴**:
- MCPプロトコルでAIエージェントと連携
- テストケースの作成・実行の自動化
- リアルタイム同時編集

### 1.2 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Frontend | React 19, React Router 7, Tailwind CSS |
| Backend | Express 5, Prisma, PostgreSQL |
| Infra | Redis, MinIO, Docker |
| 開発 | pnpm, Turborepo, TypeScript |

## 2. 初日にやること

### 2.1 アカウント設定

- [ ] GitHub組織への招待を受け入れる
- [ ] Slackワークスペースに参加
- [ ] Notionへのアクセス確認
- [ ] 1Passwordへのアクセス確認（シークレット管理）

### 2.2 開発環境セットアップ

```bash
# 1. リポジトリをクローン
git clone git@github.com:your-org/agentest.git
cd agentest

# 2. 環境変数設定
cp .env.example .env
# .envを編集（OAuthクレデンシャルはチームから取得）

# 3. Docker用シンボリックリンク作成
cd docker && ln -s ../.env .env && cd ..

# 4. Docker起動
cd docker
docker compose up --build

# 4. 別ターミナルでDB初期化
docker compose --profile tools up -d dev
docker compose exec dev pnpm install
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev
```

### 2.3 動作確認

| URL | 確認内容 |
|-----|---------|
| http://localhost:3000 | Webアプリ表示 |
| http://localhost:3001/health | API稼働確認 |
| http://localhost:9001 | MinIOコンソール |

## 3. 1週目にやること

### 3.1 ドキュメントを読む

**必読**:
- [ ] [システム全体像](../architecture/overview.md) - アーキテクチャ理解
- [ ] [開発フロー](./development.md) - 日常のワークフロー
- [ ] [コーディング規約](./development.md#コーディング規約)

**推奨**:
- [ ] [DB設計](../architecture/database/) - テーブル構造
- [ ] [API設計](../architecture/api-design.md) - API規約
- [ ] [ADR](../adr/) - 技術選定の経緯

### 3.2 コードベースの理解

**ディレクトリ構造**:
```
agentest/
├── apps/
│   ├── web/           # ユーザー向けSPA
│   ├── api/           # REST API
│   ├── ws/            # WebSocketサーバー
│   ├── admin/         # 管理画面
│   └── mcp-server/    # AI連携
├── packages/
│   ├── shared/        # 共通型・ユーティリティ
│   ├── db/            # Prismaスキーマ
│   ├── auth/          # 認証
│   ├── storage/       # S3互換ストレージ
│   └── ui/            # 共通UIコンポーネント
└── docker/            # Docker設定
```

### 3.3 最初のタスク

メンターと相談して、以下のような入門タスクに取り組みましょう：

1. **Good First Issue** - 小さなバグ修正や改善
2. **ドキュメント更新** - 古い情報の更新
3. **テスト追加** - 既存機能のテストカバレッジ向上

## 4. 開発ワークフロー

### 4.1 ブランチ戦略

```
main (本番)
  └── develop (開発)
        ├── feature/xxx  (機能開発)
        ├── fix/xxx      (バグ修正)
        └── chore/xxx    (その他)
```

### 4.2 開発の流れ

```bash
# 1. developから分岐
git checkout develop
git pull origin develop
git checkout -b feature/add-user-avatar

# 2. 開発
# コード変更...

# 3. コミット（Conventional Commits）
git add .
git commit -m "feat(users): add avatar upload feature"

# 4. プッシュ
git push origin feature/add-user-avatar

# 5. PRを作成
gh pr create --base develop
```

### 4.3 コミットメッセージ

```
feat: 新機能
fix: バグ修正
docs: ドキュメント
style: フォーマット
refactor: リファクタリング
test: テスト
chore: その他

例:
feat(auth): add Google OAuth login
fix(api): handle null user in response
docs(readme): update setup instructions
```

### 4.4 PRのルール

- タイトルはConventional Commits形式
- 説明には変更内容と確認方法を記載
- レビュアーを1名以上アサイン
- CIが通過していることを確認

## 5. よく使うコマンド

### 5.1 開発

```bash
# Docker起動
cd docker && docker compose up

# pnpmコマンド実行
docker compose exec dev pnpm install
docker compose exec dev pnpm lint
docker compose exec dev pnpm test

# 特定パッケージのみ
docker compose exec dev pnpm --filter @agentest/api test
```

### 5.2 データベース

```bash
# マイグレーション作成
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name xxx

# Prisma Studio（GUI）
docker compose exec dev pnpm --filter @agentest/db prisma studio

# DBリセット（データ削除）
docker compose exec dev pnpm --filter @agentest/db prisma migrate reset
```

### 5.3 Git

```bash
# developを最新に
git checkout develop && git pull

# 変更の確認
git status
git diff

# コミット取り消し
git reset --soft HEAD~1

# リベース（PR更新時）
git fetch origin
git rebase origin/develop
```

## 6. ツール・サービス

### 6.1 開発ツール

| ツール | 用途 | URL |
|--------|------|-----|
| GitHub | ソースコード管理 | github.com/your-org |
| Slack | コミュニケーション | your-org.slack.com |
| Notion | ドキュメント | notion.so/your-org |
| Figma | デザイン | figma.com/your-org |

### 6.2 インフラ

| サービス | 用途 |
|---------|------|
| GCP | クラウドインフラ |
| Cloud Run | アプリケーション |
| Cloud SQL | PostgreSQL |
| Cloud Storage | ファイルストレージ |

### 6.3 監視

| サービス | 用途 |
|---------|------|
| Datadog | APM、メトリクス |
| Sentry | エラー追跡 |
| PagerDuty | オンコール |

## 7. コミュニケーション

### 7.1 Slackチャンネル

| チャンネル | 用途 |
|-----------|------|
| #general | 全体連絡 |
| #dev | 開発に関する議論 |
| #pr-review | PRレビュー依頼 |
| #alerts | 監視アラート |
| #random | 雑談 |

### 7.2 定例ミーティング

| ミーティング | 頻度 | 内容 |
|-------------|------|------|
| デイリースタンドアップ | 毎日 | 進捗共有 |
| スプリント計画 | 隔週 | タスク計画 |
| 振り返り | 隔週 | 改善点の議論 |
| 1on1 | 隔週 | メンターとの1対1 |

### 7.3 質問のしかた

1. まずドキュメントを確認
2. 自分で調べた内容をメモ
3. Slackで質問（調べたことも共有）
4. 必要に応じてペアプログラミング

## 8. セキュリティ

### 8.1 やるべきこと

- 2FAを有効化（GitHub, Slack, GCP）
- シークレットは1Passwordで管理
- 本番環境へのアクセスは必要最小限

### 8.2 やってはいけないこと

- シークレットをSlackやGitに共有しない
- 本番データをローカルにダウンロードしない
- 個人デバイスに機密情報を保存しない

## 9. 困ったら

### 9.1 よくある問題

| 問題 | 解決方法 |
|------|---------|
| Dockerが起動しない | [トラブルシューティング](./troubleshooting.md#docker-compose-が起動しない) |
| 型エラーが出る | `pnpm --filter @agentest/db prisma generate` |
| PRのCIが落ちる | ログを確認してローカルで修正 |

### 9.2 相談先

| 相談内容 | 相談先 |
|---------|--------|
| 技術的な質問 | #dev または メンター |
| 環境構築 | メンター |
| プロダクトの質問 | PM |
| 人事・制度 | マネージャー |

## 10. チェックリスト

### 1週目終了時

- [ ] 開発環境が動作している
- [ ] 最初のPRをマージした
- [ ] チームメンバーと顔合わせした
- [ ] 主要ドキュメントを読んだ

### 1ヶ月終了時

- [ ] 複数の機能開発に携わった
- [ ] コードレビューを受けた/した
- [ ] アーキテクチャを理解した
- [ ] 独力でタスクを完了できるようになった

---

## 関連ドキュメント

- [初回セットアップ](./getting-started.md)
- [開発フロー](./development.md)
- [トラブルシューティング](./troubleshooting.md)
- [システム全体像](../architecture/overview.md)
