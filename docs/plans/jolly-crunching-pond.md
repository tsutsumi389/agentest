# OSS移行プラン

## Context

AgentestをSaaSからOSSに転換する。SaaS運用に必要だった課金・プラン制限・SaaS運用メトリクスを削除し、セルフホスト型のテスト管理ツールとして再構築する。

**決定事項:**
- 利用形態: セルフホスト（マルチテナント維持）
- 認証: メール/パスワード + OAuth（GitHub/Google）維持
- 管理画面: 簡素化して残す
- GCPインフラ: Terraformは維持

---

## 1. 削除対象（SaaS専用機能）

### 1-1. 課金システム全体

| 対象 | ファイル/ディレクトリ | 理由 |
|------|---------------------|------|
| Stripe Gateway | `apps/api/src/gateways/payment/` | 課金不要 |
| サブスクリプションサービス | `apps/api/src/services/subscription.service.ts` | 課金不要 |
| 組織サブスクリプション | `apps/api/src/services/organization-subscription.service.ts` | 課金不要 |
| Webhookサービス | `apps/api/src/services/webhook.service.ts` | Stripe webhook不要 |
| 課金APIルート | `apps/api/src/routes/` 内の課金関連 | 課金不要 |
| Webhook APIルート | `apps/api/src/routes/webhooks/` | Stripe webhook不要 |
| プラン料金設定 | `packages/shared/src/config/plan-pricing.ts` | 課金不要 |
| 課金バリデーション | `packages/shared/` 内のサブスク関連スキーマ | 課金不要 |

**DBモデル削除:**
- `Subscription`
- `Invoice`
- `PaymentMethod`
- `PaymentEvent`

### 1-2. 課金関連バッチジョブ

| ジョブ | ファイル | 理由 |
|-------|--------|------|
| subscription-sync | `apps/jobs/src/jobs/subscription-sync.ts` | Stripe同期不要 |
| webhook-retry | `apps/jobs/src/jobs/webhook-retry.ts` | Stripe webhook不要 |
| payment-event-cleanup | `apps/jobs/src/jobs/payment-event-cleanup.ts` | PaymentEvent不要 |

### 1-3. SaaS運用メトリクス

| 対象 | ファイル | 理由 |
|------|--------|------|
| プラン分布集計ジョブ | `apps/jobs/src/jobs/plan-distribution-aggregation.ts` | プラン課金不要 |
| メトリクス集計ジョブ | `apps/jobs/src/jobs/metrics-aggregation.ts` | SaaS KPI不要 |
| メトリクスバックフィル | `apps/jobs/src/jobs/metrics-backfill.ts` | SaaS KPI不要 |
| メトリクスAPIルート | `apps/api/src/routes/admin/metrics.ts` | SaaS KPI不要 |
| メトリクスサービス | `apps/api/src/services/admin-metrics.service.ts` | SaaS KPI不要 |

**DBモデル削除:**
- `ActiveUserMetric`
- `PlanDistributionMetric`

### 1-4. プラン制限・使用量管理

| 対象 | 説明 | 理由 |
|------|------|------|
| プラン制限チェック | プロジェクト数・テストケース数の上限チェックロジック | 全機能無制限化 |
| 使用量追跡 | `UsageRecord` モデルとMCPセッション制限 | 制限不要 |
| プラン別履歴保持 | `history-cleanup` ジョブのFREEプラン判定 | プラン不要 |

**DBモデル削除:**
- `UsageRecord`

### 1-5. Web画面の課金UI

| 対象 | ファイル | 理由 |
|------|--------|------|
| プラン表示カード | `apps/web/src/components/organization/billing/OrgCurrentPlanCard.tsx` | 課金不要 |
| 支払い方法管理 | `apps/web/src/components/organization/billing/OrgPaymentMethodsCard.tsx` | 課金不要 |
| 請求書一覧 | `apps/web/src/components/organization/billing/OrgInvoiceList.tsx` | 課金不要 |
| 支払い方法追加 | `apps/web/src/components/organization/billing/OrgAddPaymentMethodModal.tsx` | 課金不要 |
| プラン変更モーダル | `apps/web/src/components/organization/billing/OrgPlanChangeModal.tsx` | 課金不要 |
| プラン料金計算API | `/api/plans/:plan/calculate` ルート | 課金不要 |
| プラン一覧API | `/api/plans` ルート | 課金不要 |

---

## 2. 簡素化対象

### 2-1. プラン概念の廃止

**現状:** `UserPlan` (FREE/PRO)、`OrganizationPlan` (NONE/TEAM/ENTERPRISE)
**変更:** プラン概念を完全廃止。全ユーザー・全組織が全機能を無制限で利用可能。

- `User.plan` フィールド削除
- `Organization.plan` フィールド削除
- `Organization.paymentCustomerId`, `Organization.billingEmail` フィールド削除
- プラン関連の enum (`UserPlan`, `OrganizationPlan`, `SubscriptionPlan` 等) 削除
- プランに基づく機能制限チェックをすべて除去

### 2-2. 管理画面の簡素化

**現状:** ダッシュボード、ユーザー管理、組織管理、監査ログ、メトリクス、システム管理者
**変更:** 以下に絞る

| 残す画面 | 機能 |
|---------|------|
| ダッシュボード | ユーザー数・組織数・プロジェクト数の基本統計（売上・プラン分布は削除） |
| ユーザー管理 | 一覧・詳細表示・サスペンド（サブスク情報セクション削除） |
| 組織管理 | 一覧・詳細表示（サブスク情報セクション削除） |
| システム管理者 | 管理者の管理・招待 |

**削除する画面:**
- メトリクスページ（DAU/WAU/MAU、プラン分布、収益）
- ダッシュボードの売上統計カード (`RevenueStatsCard`)

### 2-3. 監査ログの簡素化

**現状:** `BILLING` カテゴリを含む7カテゴリ
**変更:** `BILLING` カテゴリ削除。残り6カテゴリ（AUTH/USER/ORGANIZATION/MEMBER/PROJECT/API_TOKEN）は維持。

### 2-4. history-cleanup ジョブの簡素化

**現状:** FREEプランユーザーの30日以上前の履歴を削除
**変更:** プラン判定を削除。全ユーザー統一のクリーンアップポリシー（環境変数で保持日数を設定可能にする）

### 2-5. OAuth 2.1 (MCP認証) の維持判断

MCP Server向けのOAuth 2.1実装（RFC 9728/7591準拠）はOSSでも価値がある。**維持する。**

### 2-6. 2FA (TOTP) の維持判断

セキュリティ機能として価値がある。**維持する。**

---

## 3. 変更作業の分類（実行順）

### Phase 1: DBスキーマ変更
課金・メトリクス関連モデルの削除、プラン関連フィールドの削除。マイグレーション作成。

**削除モデル:** `Subscription`, `Invoice`, `PaymentMethod`, `PaymentEvent`, `UsageRecord`, `ActiveUserMetric`, `PlanDistributionMetric`
**フィールド削除:** `User.plan`, `Organization.plan`, `Organization.paymentCustomerId`, `Organization.billingEmail`
**Enum削除:** `UserPlan`, `OrganizationPlan`, `SubscriptionPlan`, `SubscriptionStatus`, `BillingCycle`, `InvoiceStatus`, `PaymentMethodType`
**AuditLogCategory:** `BILLING` を削除

### Phase 2: 共有パッケージ（packages/shared）
型定義・enum・バリデーションスキーマから課金関連を削除。

### Phase 3: APIバックエンド（apps/api）
- 課金Gateway・サービス・ルート削除
- プラン制限チェックロジック除去
- Webhook処理削除
- 管理APIからメトリクス・課金関連削除

### Phase 4: バッチジョブ（apps/jobs）
- 課金関連ジョブ3本削除（subscription-sync, webhook-retry, payment-event-cleanup）
- メトリクスジョブ3本削除（metrics-aggregation, metrics-backfill, plan-distribution-aggregation）
- history-cleanupのプラン判定ロジック簡素化

### Phase 5: Web フロントエンド（apps/web）
- 課金UIコンポーネント削除
- 組織設定画面から課金セクション削除
- プラン表示・制限UIの除去

### Phase 6: Admin フロントエンド（apps/admin）
- メトリクスページ削除
- ダッシュボードから売上統計削除
- ユーザー/組織詳細からサブスク情報セクション削除

### Phase 7: 認証パッケージ（packages/auth）
- Stripe関連の環境変数参照削除
- プランベースの権限チェック除去

### Phase 8: インフラ（infrastructure/terraform）
- Cloud Run Jobsから削除ジョブ分を除去
- Stripe関連Secret Manager変数を削除
- 変更後の構成を反映

### Phase 9: ドキュメント・設定
- README.mdをOSS向けに書き換え
- セットアップガイド作成（Docker Compose中心）
- LICENSE追加
- CONTRIBUTING.md追加
- 環境変数ドキュメント更新（Stripe関連削除）
- CLAUDE.mdのプロジェクト説明更新

---

## 4. 仕様簡素化の提案

### 提案A: メール認証の省略オプション
**現状:** ユーザー登録時にメール確認必須
**提案:** 環境変数 `REQUIRE_EMAIL_VERIFICATION=false` でスキップ可能に。セルフホスト環境ではSMTP設定が面倒な場合が多い。

### 提案B: 初回セットアップウィザード
**提案:** 初回起動時に管理者アカウント作成、基本設定を行うセットアップフロー。SaaSでは不要だったがOSSでは利便性が大幅に向上する。

### 提案C: 環境変数での機能トグル
**提案:** OAuth（GitHub/Google）を環境変数で有効/無効を制御。設定していなければ自動的にメール認証のみになる設計（現状もある程度対応済みの可能性あり）。

### 提案D: Redisの任意化
**現状:** WebSocketのPub/SubにRedis必須
**提案:** シングルインスタンス運用ならインメモリPub/Subで代替可能。Redis接続がない場合はフォールバック。セットアップの敷居を下げる。

### 提案E: MinIO/S3の任意化
**提案:** エビデンスストレージにローカルファイルシステムをフォールバックとして追加。S3/MinIO設定なしでも基本機能が使える。

---

## 5. 変更規模の概算

| Phase | 影響範囲 | 作業種別 |
|-------|---------|---------|
| 1. DBスキーマ | モデル7個削除、フィールド4個削除、Enum7個削除 | 削除 |
| 2. 共有パッケージ | 型定義・スキーマ20〜30箇所 | 削除・修正 |
| 3. APIバックエンド | サービス4個、ルート5グループ、Gateway1個削除 | 削除・修正 |
| 4. バッチジョブ | ジョブ6本削除、1本修正 | 削除・修正 |
| 5. Web画面 | コンポーネント5個削除、画面2〜3箇所修正 | 削除・修正 |
| 6. Admin画面 | ページ1個削除、コンポーネント3〜5個修正 | 削除・修正 |
| 7. 認証 | 軽微な修正 | 修正 |
| 8. インフラ | Terraform設定修正 | 修正 |
| 9. ドキュメント | 5〜6ファイル | 新規・修正 |
