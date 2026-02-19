# OSS向けドキュメント整理計画

## Context

AgentestをOSSとして公開するにあたり、`docs/` 配下のドキュメントを整理する。現状のドキュメントはSaaS運用時代のものが多く残っており、以下の問題がある：

- SaaS内部運用ドキュメント（operations/, legal/, plans/）が残存
- 既存ドキュメント内にSaaS固有の記述（課金プラン、GCPインフラ、内部ツール参照）が散在
- OSS標準のドキュメント（LICENSE, CONTRIBUTING.md, SECURITY.md, GitHubテンプレート）が未作成
- ルートREADME.mdが11行のみで、OSSプロジェクトとして不十分

**方針**: MIT License / 日本語のみ / SaaS記述のクリーンアップ含む / ルートREADME書き直し含む

---

## Phase 1: 不要ファイルの削除（13ファイル + 2ディレクトリ）

### 1-1. SaaS運用ドキュメント削除（`docs/operations/` 全9ファイル → ディレクトリごと削除）

| ファイル | 理由 |
|---------|------|
| `runbook.md` | Datadog, Slack #alerts, Cloud Run本番URL等の内部運用 |
| `sla.md` | Free/Pro/Team/Enterpriseプランの SLA定義 |
| `monitoring.md` | Datadog, Grafana, PagerDuty設定 |
| `backup-restore.md` | Cloud SQL固有のバックアップ手順 |
| `database-operations.md` | Cloud SQL固有のDB運用 |
| `incident-response.md` | 内部エスカレーションフロー |
| `secrets-management.md` | GCP Secret Manager固有 |
| `security.md` | SOC 2, ISO 27001等の内部セキュリティポスチャー |
| `batch-jobs-runbook.md` | Cloud Run Jobs固有の運用手順 |

### 1-2. SaaS法的文書削除（`docs/legal/` 全3ファイル → ディレクトリごと削除）

- `terms-of-service.md` / `privacy-policy.md` / `commercial-transactions.md`

### 1-3. その他の削除

- `docs/guides/onboarding.md` — 内部チームオンボーディング（Slack, Notion, 1Password参照）

> **残すもの**: `docs/plans/` （内部計画として残す）、`docs/architecture/diagrams/gcp-architecture.drawio.*`（GCPアーキテクチャ図として残す）

---

## Phase 2: 既存ファイルのSaaS記述クリーンアップ（約20ファイル）

### 2-1. データベース定義（3ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `docs/architecture/database/notification.md` | `NotificationType` enumから `USAGE_ALERT`, `BILLING` 削除 |
| `docs/architecture/database/api-token.md` | スコープ一覧から `admin:billing` 削除 |
| `docs/architecture/database/index.md` | `NotificationType` 一覧更新、`requirements/` への壊れたリンク削除 |

### 2-2. API定義（4ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `docs/api/admin-dashboard.md` | `byPlan`, `revenue` ブロック、`AdminDashboardRevenueStats` 型削除 |
| `docs/api/admin-users.md` | `plan` パラメータ/フィールド、`subscription` オブジェクト、`AdminUserSubscription` 型削除 |
| `docs/api/notifications.md` | 通知タイプから `USAGE_ALERT`, `BILLING` 削除 |
| `docs/api/README.md` | ベースURLを `https://<your-domain>/api/v1` に変更 |

### 2-3. アーキテクチャ仕様（4ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `docs/architecture/overview.md` | GCPサービス名をジェネリック名に（Cloud SQL→PostgreSQL, Memorystore→Redis等） |
| `docs/architecture/api-design.md` | CORS設定の `app.agentest.io` を環境変数参照に変更 |
| `docs/architecture/database.md` | `requirements/` への壊れたリンク削除 |
| `docs/architecture/diagrams/system-overview.md` | デプロイ構成図のGCPサービス名をジェネリック化 |

### 2-4. 機能仕様（7ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `docs/architecture/features/admin-system.md` | 「SaaS全体の」→「システムの」、ダッシュボードのプラン別統計削除 |
| `docs/architecture/features/audit-log.md` | プラン別保持期間 → 単一の設定可能な保持期間に変更 |
| `docs/architecture/features/authentication.md` | Userモデルの `plan` フィールド削除、利用規約リンク記述削除 |
| `docs/architecture/features/batch-processing.md` | Cloud Scheduler/Cloud Run Jobs → ジェネリック名、壊れたリンク削除 |
| `docs/architecture/features/notification.md` | `USAGE_ALERT`, `BILLING` 通知タイプ削除 |
| `docs/architecture/features/organization.md` | `ORG-008 組織課金` 行削除 |
| `docs/architecture/features/README.md` | 必要に応じてリンク更新 |

### 2-5. ガイド（2ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `docs/guides/deployment.md` | **全面書き直し**: GCP固有 → Docker Composeベースのセルフホストデプロイガイド |
| `docs/guides/troubleshooting.md` | Cloud Armor参照→express-rate-limit、gcloudコマンド→docker compose、削除済みファイルへのリンク除去 |

### 2-6. ドキュメントインデックス（1ファイル）

| ファイル | 変更内容 |
|---------|---------|
| `docs/README.md` | **ほぼ全面書き直し**: requirements/legal/operations/plans参照削除、OSS向け構成に更新 |

---

## Phase 3: 新規ファイルの追加（8ファイル）

### 3-1. ルートレベルのOSS標準ファイル

| ファイル | 内容 |
|---------|------|
| `LICENSE` | MIT License（Copyright 2025 Agentest Contributors） |
| `CONTRIBUTING.md` | コントリビューションガイド（development.md/testing.mdへのリンク、ブランチ戦略、コミット規約、PRチェックリスト） |
| `SECURITY.md` | 脆弱性報告プロセス（GitHub Security Advisories利用、セルフホスト時のセキュリティ推奨事項） |

### 3-2. ルートREADME.md 書き直し

現在11行 → OSS標準構成で書き直し:
- プロジェクト概要（Coding Agent向けテスト管理ツール）
- 主な機能（MCP連携、テスト管理、レビュー、リアルタイム更新等）
- クイックスタート（Docker Compose 手順）
- MCP連携の設定例
- 技術スタック表
- ドキュメントリンク
- コントリビューション・ライセンスセクション

### 3-3. GitHubテンプレート

| ファイル | 内容 |
|---------|------|
| `.github/ISSUE_TEMPLATE/bug_report.md` | バグ報告テンプレート（再現手順、環境情報） |
| `.github/ISSUE_TEMPLATE/feature_request.md` | 機能要望テンプレート |
| `.github/pull_request_template.md` | PRテンプレート（概要、変更理由、テスト方法、チェックリスト） |

### 3-4. package.json 修正

- `"license": "MIT"` フィールドを追加

---

## Phase 4: 検証

### 4-1. 壊れたリンクの確認

削除したファイルへの参照が残っていないことを確認:
```bash
grep -r "requirements/" docs/
grep -r "operations/" docs/
grep -r "legal/" docs/
grep -r "onboarding.md" docs/
grep -r "batch-jobs-runbook" docs/
```

### 4-2. SaaSキーワードの残存確認

```bash
# 課金・プラン関連
grep -r "byPlan\|\.mrr\|revenue\|invoice\|subscription\|admin:billing" docs/ --include="*.md"
grep -r "FREE.*PRO\|USAGE_ALERT\|BILLING" docs/ --include="*.md"

# GCP固有
grep -r "Cloud SQL\|Cloud Run\|Cloud Scheduler\|Memorystore\|gcloud\|gcr\.io\|Secret Manager\|Cloud CDN\|Cloud Armor\|Cloud Build" docs/ --include="*.md"

# SaaS内部URL・ドメイン
grep -r "agentest\.io\|staging-api\|staging\." docs/ --include="*.md"

# 内部ツール
grep -r "Datadog\|PagerDuty\|SOC 2\|ISO 27001" docs/ --include="*.md"
```

### 4-3. 追加ファイルの存在確認

```bash
ls -la LICENSE CONTRIBUTING.md SECURITY.md
cat package.json | grep '"license"'
ls .github/ISSUE_TEMPLATE/
ls .github/pull_request_template.md
```

### 4-4. ビルド確認

```bash
docker compose exec dev pnpm build
```

---

## 対象ファイル一覧

### 削除（13ファイル + 2ディレクトリ）
- `docs/operations/` （9ファイル + ディレクトリ）
- `docs/legal/` （3ファイル + ディレクトリ）
- `docs/guides/onboarding.md`

### 修正（約20ファイル）
- `docs/README.md`
- `docs/api/README.md`, `admin-dashboard.md`, `admin-users.md`, `notifications.md`
- `docs/architecture/overview.md`, `api-design.md`, `database.md`
- `docs/architecture/database/index.md`, `notification.md`, `api-token.md`
- `docs/architecture/diagrams/system-overview.md`
- `docs/architecture/features/admin-system.md`, `audit-log.md`, `authentication.md`, `batch-processing.md`, `notification.md`, `organization.md`
- `docs/guides/deployment.md`（全面書き直し）, `troubleshooting.md`

### 追加（8ファイル）
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`
- `README.md`（書き直し）
- `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`
- `.github/pull_request_template.md`
- `package.json`（licenseフィールド追加）
