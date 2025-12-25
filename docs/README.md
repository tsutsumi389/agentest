# Agentest ドキュメント

テスト管理ツール SaaS「Agentest」の技術ドキュメントです。

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

### 開発者向け
- [初回セットアップ](./guides/getting-started.md)
- [開発フロー](./guides/development.md)
- [システム全体像](./architecture/overview.md)
- [API 認証](./api/auth.md)
- [API レート制限](./api/rate-limits.md)

### サービス運用
- [SLA（サービスレベルアグリーメント）](./operations/sla.md)
- [セキュリティ対策](./operations/security.md)
- [インシデント対応](./operations/incident-response.md)

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
