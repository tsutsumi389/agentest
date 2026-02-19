# Agentest ドキュメント

テスト管理ツール「Agentest」の技術ドキュメントです。

## ドキュメント構成

| ディレクトリ | 内容 | 対象読者 |
|-------------|------|---------|
| [architecture/](./architecture/) | システム設計・アーキテクチャ | 開発者、コントリビューター |
| [adr/](./adr/) | 技術的意思決定の記録 | 開発者 |
| [guides/](./guides/) | 開発者向けガイド | 開発者 |
| [api/](./api/) | API リファレンス | フロントエンド、外部連携 |

## クイックリンク

### はじめに
- [初回セットアップ](./guides/getting-started.md) - 開発環境構築
- [システム全体像](./architecture/overview.md) - アーキテクチャ理解
- [デプロイ手順](./guides/deployment.md) - セルフホスト環境へのデプロイ

### 開発者向け
- [開発フロー](./guides/development.md) - 日常のワークフロー
- [トラブルシューティング](./guides/troubleshooting.md) - よくある問題と解決方法
- [API リファレンス](./api/README.md) - REST API ドキュメント
- [API 認証](./api/auth.md) - 認証の実装

### アーキテクチャ
- [システム全体像](./architecture/overview.md) - システム構成図・通信フロー
- [データベース設計](./architecture/database.md) - テーブル一覧
- [API 設計方針](./architecture/api-design.md) - RESTful API 設計
- [機能別設計書](./architecture/features/README.md) - 各機能の仕様

## ドキュメント更新ルール

1. 設計変更時は `architecture/` を更新
2. 技術的意思決定は `adr/` に記録
3. 手順変更時は `guides/` を更新
4. API 変更時は `api/` を更新
