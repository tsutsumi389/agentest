# Agentest ドキュメント

テスト管理ツール「Agentest」の技術ドキュメントです。

## ドキュメント構成

| ディレクトリ | 内容 | 対象読者 |
|-------------|------|---------|
| [architecture/](./architecture/) | システム設計・アーキテクチャ | 新規メンバー、設計レビュー |
| [adr/](./adr/) | 技術的意思決定の記録 | チーム全体 |
| [guides/](./guides/) | 開発者向けガイド | 開発者 |
| [api/](./api/) | API リファレンス | フロントエンド、外部連携 |
| [requirements/](./requirements/) | 機能要件 | プロダクトマネージャー、開発者 |
| [legal/](./legal/) | 利用規約・プライバシーポリシー | 法務、ユーザー |
| [operations/](./operations/) | 運用・SLA・セキュリティ | 運用チーム |
| [plans/](./plans/) | 実装計画 | 実装担当者 |

## クイックリンク

### 新メンバー向け
- [オンボーディングガイド](./guides/onboarding.md) - 最初に読む
- [初回セットアップ](./guides/getting-started.md) - 開発環境構築
- [システム全体像](./architecture/overview.md) - アーキテクチャ理解

### 開発者向け
- [開発フロー](./guides/development.md) - 日常のワークフロー
- [トラブルシューティング](./guides/troubleshooting.md) - よくある問題と解決方法
- [API 認証](./api/auth.md) - 認証の実装
- [管理者監査ログ API](./api/admin-audit-logs.md) - 全体監査ログ閲覧
- [認証基盤詳細設計](./architecture/phase1-auth/README.md) - Phase 1 認証基盤の詳細設計

### サービス運用
- [Runbook（運用手順書）](./operations/runbook.md) - 日常運用タスク
- [バッチジョブ運用](./operations/batch-jobs-runbook.md) - Cloud Run Jobs 管理
- [監視・アラート設定](./operations/monitoring.md) - メトリクス・ログ・アラート
- [バックアップ・リストア](./operations/backup-restore.md) - データ保護
- [データベース運用](./operations/database-operations.md) - DB管理
- [シークレット管理](./operations/secrets-management.md) - 環境変数・機密情報
- [インシデント対応](./operations/incident-response.md) - 障害対応フロー
- [SLA](./operations/sla.md) - サービスレベル保証
- [セキュリティ対策](./operations/security.md) - セキュリティ実装

### 法的文書
- [利用規約](./legal/terms-of-service.md)
- [プライバシーポリシー](./legal/privacy-policy.md)
- [特定商取引法に基づく表記](./legal/commercial-transactions.md)

## ドキュメント更新ルール

1. 設計変更時は `architecture/` を更新
2. 技術的意思決定は `adr/` に記録
3. 手順変更時は `guides/` を更新
4. API 変更時は `api/` を更新
5. 法的文書の変更は法務レビュー必須
6. SLA 変更時は事前にユーザー通知が必要
