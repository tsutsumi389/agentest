# 機能別設計書

このディレクトリには、Agentestの各機能の仕様書を機能単位で管理しています。

## 機能一覧

### 認証・ユーザー管理

| 機能 | 説明 | ドキュメント |
|------|------|-------------|
| 認証 | OAuth認証、セッション管理 | [authentication.md](./authentication.md) |
| ユーザー管理 | プロフィール、アカウント設定 | [user-management.md](./user-management.md) |

### 組織・チーム管理

| 機能 | 説明 | ドキュメント |
|------|------|-------------|
| 組織管理 | 組織の作成・設定・削除 | [organization.md](./organization.md) |
| メンバー管理 | 招待、ロール、メンバー削除 | [member-management.md](./member-management.md) |
| 監査ログ | 操作履歴の記録・閲覧 | [audit-log.md](./audit-log.md) |

### テスト管理

| 機能 | 説明 | ドキュメント |
|------|------|-------------|
| プロジェクト管理 | プロジェクトの作成・設定・削除・環境管理 | [project-management.md](./project-management.md) |
| プロジェクトダッシュボード | KPI・結果分布・要注意テスト・活動表示、フィルター機能 | [project-dashboard.md](./project-dashboard.md) |
| テストスイート | テストスイートの管理 | [test-suite-management.md](./test-suite-management.md) |
| テストケース | テストケースの作成・編集・コピー・履歴管理 | [test-case-management.md](./test-case-management.md) |
| テスト実行 | テスト実行と結果管理 | [test-execution.md](./test-execution.md) |
| レビューコメント | テストスイート/ケースへのレビュー・返信・ステータス管理 | [review-comment.md](./review-comment.md) |

### AI連携

| 機能 | 説明 | ドキュメント |
|------|------|-------------|
| MCP連携 | AIエージェント連携（MCPサーバー）- 検索/取得/作成/更新/削除ツール、MCP Apps（テストスイート一覧App）実装済 | [mcp-integration.md](./mcp-integration.md) |

### 通知

| 機能 | 説明 | ドキュメント |
|------|------|-------------|
| 通知 | メール・アプリ内通知、WebSocket リアルタイム配信 | [notification.md](./notification.md) |

### バッチ処理

| 機能 | 説明 | ドキュメント |
|------|------|-------------|
| バッチ処理 | 履歴クリーンアップ、メトリクス集計 | [batch-processing.md](./batch-processing.md) |

### 管理者システム

| 機能 | 説明 | ドキュメント |
|------|------|-------------|
| システム管理者機能 | 管理者認証・2FA・ダッシュボード・ユーザー管理・監査ログ | [admin-system.md](./admin-system.md) |
| 管理者認証 | 管理者ログイン、2FA、セッション管理 | [authentication.md](./authentication.md#管理者認証機能) |
| 管理者ダッシュボード | システム統計 | [admin-dashboard API](../../api/admin-dashboard.md) |
| 管理者ユーザー管理 | ユーザー一覧・検索・フィルタ | [admin-users API](../../api/admin-users.md) |

## ドキュメント構成

各機能ドキュメントは以下の構成で記載しています：

1. **概要** - 機能の目的と範囲
2. **機能一覧** - 提供する機能の一覧表
3. **画面仕様** - 画面の表示要素と操作
4. **業務フロー** - 処理の流れ（mermaid図）
5. **データモデル** - 関連するデータ構造
6. **ビジネスルール** - 制約条件とルール
7. **権限** - ロール別のアクセス権限
8. **設定値** - 設定可能なパラメータ
9. **関連機能** - 他機能との依存関係

## 関連ドキュメント

- [システムアーキテクチャ](../overview.md)
- [API設計方針](../api-design.md)
- [データベース設計](../database/index.md)
