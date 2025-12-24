# Agentest ドキュメント

テスト管理ツール SaaS「Agentest」の技術ドキュメントです。

## ドキュメント構成

| ディレクトリ | 内容 | 対象読者 |
|-------------|------|---------|
| [architecture/](./architecture/) | システム設計・アーキテクチャ | 新規メンバー、設計レビュー |
| [adr/](./adr/) | 技術的意思決定の記録 | チーム全体 |
| [guides/](./guides/) | 開発者向けガイド | 開発者 |
| [api/](./api/) | API リファレンス | フロントエンド、外部連携 |
| [plans/](./plans/) | 実装計画 | 実装担当者 |

## クイックリンク

- [初回セットアップ](./guides/getting-started.md)
- [開発フロー](./guides/development.md)
- [システム全体像](./architecture/overview.md)
- [API 認証](./api/auth.md)

## ドキュメント更新ルール

1. 設計変更時は `architecture/` を更新
2. 技術的意思決定は `adr/` に記録
3. 手順変更時は `guides/` を更新
4. API 変更時は `api/` を更新
