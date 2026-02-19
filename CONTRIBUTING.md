# コントリビューションガイド

Agentest へのコントリビューションに興味を持っていただきありがとうございます。

## 開発環境のセットアップ

1. リポジトリをフォーク・クローン
2. [開発ガイド](docs/guides/development.md) に従って環境を構築
3. [初回セットアップ](docs/guides/getting-started.md) を完了

```bash
git clone https://github.com/<your-username>/agentest.git
cd agentest/docker
docker compose up
```

## ブランチ戦略

| ブランチ | 用途 |
|---------|------|
| `main` | 安定版リリース |
| `feat/*` | 新機能の開発 |
| `fix/*` | バグ修正 |
| `docs/*` | ドキュメント更新 |
| `refactor/*` | リファクタリング |

## コミット規約

[Conventional Commits](https://www.conventionalcommits.org/) に従います。

```
<type>: <description>

<optional body>
```

**type**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

例:
```
feat: テストスイートの一括削除機能を追加
fix: テストケースのソート順が保持されない問題を修正
docs: デプロイ手順を更新
```

## Pull Request の作成

### チェックリスト

PR を作成する前に以下を確認してください:

- [ ] ビルドが通ること (`docker compose exec dev pnpm build`)
- [ ] テストが通ること (`docker compose exec dev pnpm test`)
- [ ] Lint エラーがないこと (`docker compose exec dev pnpm lint`)
- [ ] 必要に応じてドキュメントを更新
- [ ] コミットメッセージが規約に従っている

### PR の書き方

1. 変更の概要を簡潔に記載
2. 変更の理由（なぜこの変更が必要か）を説明
3. テスト方法を記載
4. 関連する Issue があればリンク

## コーディング規約

- TypeScript を使用
- コードのコメントは日本語で記載
- `console.log` は本番コードで使用しない（Pino ロガーを使用）
- Zod によるバリデーション
- 詳細は [CLAUDE.md](CLAUDE.md) を参照

## テスト

```bash
# 全テスト実行
docker compose exec dev pnpm test

# 特定パッケージのテスト
docker compose exec dev pnpm --filter @agentest/api test
```

## Issue の報告

バグ報告や機能要望は [GitHub Issues](https://github.com/tsutsumi389/agentest/issues) で受け付けています。

- バグ報告: 再現手順、環境情報を記載
- 機能要望: ユースケースと期待する動作を記載

## ライセンス

コントリビューションは [MIT License](LICENSE) の下で提供されます。
