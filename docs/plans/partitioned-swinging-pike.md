# 課金システム削除後のドキュメント更新計画

## Context

`piped-giggling-wind.md` の実装が完了し、課金システム（Stripe連携、サブスクリプション、支払い方法、請求書、プラン制限、使用量管理）が全てコードベースから削除済み。ドキュメントにはまだ旧課金システムの記述が多数残っているため、これらを更新・削除する。

---

## Phase 1: ドキュメントファイルの削除（3ファイル）

課金専用ドキュメントを丸ごと削除する。

| ファイル | 行数 | 理由 |
|---------|------|------|
| `docs/api/billing.md` | 1186行 | 課金API仕様（全て削除済みエンドポイント） |
| `docs/architecture/features/billing.md` | 757行 | 課金機能設計書 |
| `docs/architecture/database/billing.md` | 349行 | 課金DBスキーマ |

---

## Phase 2: データベース設計ドキュメントの更新

### 2-1: `docs/architecture/database/index.md`

- **L37-44**: 「課金・サブスクリプション」セクション（Subscription, Invoice, PaymentMethod テーブル行）を削除
- **L76-78**: メトリクスセクションから `PlanDistributionMetric` 行を削除
- **L80-84**: 「使用量記録」セクション全体（UsageRecord）を削除
- **L209**: ENUM一覧から `SubscriptionStatus` 行を削除
- **L210**: `InvoiceStatus` 行を削除
- **L222**: `BillingCycle` 行を削除
- **L223**: `PaymentMethodType` 行を削除
- **L224**: `NotificationType` から `USAGE_ALERT`, `BILLING` を除去
- **L225**: `AuditLogCategory` から `BILLING` を除去
- **L229-235**: 「プラン系」セクション全体（UserPlan, OrganizationPlan, SubscriptionPlan）を削除
- **L321-328**: インデックス戦略の「課金・サブスクリプション」セクションを削除
- **L363-370**: プラン分布メトリクス、使用量記録のインデックスを削除
- **L417**: 関連ドキュメントから `課金・サブスクリプション(billing.md)` リンクを削除
- **L421**: `使用量記録(usage.md)` リンクを削除

### 2-2: `docs/architecture/database/auth.md`

- **L25**: User カラム定義テーブルから `plan` 行を削除
- **L30-35**: 「個人プラン」セクション全体を削除
- **L45-48**: Prisma スキーマから `UserPlan` enumを削除
- **L61**: `plan UserPlan @default(FREE)` を削除
- **L82**: `subscription Subscription?` リレーションを削除
- **L86**: `usageRecords UsageRecord[]` リレーションを削除
- **L349**: 関連機能から `USR-007 個人プラン選択` を削除
- **L356**: 関連ドキュメントから `課金・サブスクリプション(billing.md)` リンクを削除

### 2-3: `docs/architecture/database/organization.md`

- **L19**: Organization カラム定義テーブルから `plan` 行を削除
- **L20**: `billingEmail` 行を削除
- **L25-31**: 「組織プラン」セクション全体を削除
- **L35**: 制約の `billingEmail` を削除
- **L40-44**: Prisma スキーマから `OrganizationPlan` enumを削除
- **L51**: `plan OrganizationPlan @default(NONE)` を削除
- **L52**: `billingEmail String?` を削除
- **L60**: `subscription Subscription?` リレーションを削除
- **L63**: `usageRecords UsageRecord[]` リレーションを削除
- **L92**: 権限レベルの ADMIN 説明から「課金管理 +」を除去
- **L416**: 関連機能から `ORG-006 組織プラン選択` を削除
- **L417**: `ORG-007 請求先設定` を削除
- **L437**: 関連ドキュメントから `課金・サブスクリプション(billing.md)` リンクを削除

### 2-4: `docs/architecture/database/metrics.md`

- **L11**: テーブル一覧から `PlanDistributionMetric` 行を削除
- **L90-153**: `PlanDistributionMetric` セクション全体を削除
- **L155-180**: ER図の `PlanDistributionMetric` 部分を削除

### 2-5: `docs/architecture/database/usage.md`

- **ファイル全体を削除**: UsageRecordテーブルは課金システムと共に削除済み

### 2-6: `docs/architecture/database/audit-log.md`

- **L39**: イベントカテゴリテーブルから `BILLING` 行を削除
- **L51**: アクション例から `BILLING | plan_change, payment_method_add, payment_method_remove` 行を削除
- **L69-75**: ログ保持期間テーブル → プランベースの保持期間を単一の固定値に変更（例: 全ユーザー90日）
- **L87-88**: Prisma スキーマの `AuditLogCategory` enumから `BILLING` を削除

---

## Phase 3: アーキテクチャドキュメントの更新

### 3-1: `docs/architecture/overview.md`

- **L1,5**: 「SaaS」→「テスト管理ツール」に変更
- **L58**: システム構成図のBatch LayerからStripeを除去
- **L211-218**: 環境変数テーブルから PAYMENT_GATEWAY, STRIPE_* 関連の8行を削除

### 3-2: `docs/architecture/api-design.md`

- **L191**: CSP scriptSrc から `"https://js.stripe.com"` を除去
- **L194**: frameSrc から `"https://js.stripe.com"` を除去
- **L195**: connectSrc から `"https://js.stripe.com"` を除去
- **L202**: Stripe Elements に関する Note を削除
- **L204-212**: 「Webhook ルートの特殊処理」セクション全体を削除

### 3-3: `docs/architecture/features/README.md`

- **L39-44**: 「通知・課金」セクションを「通知」に変更、課金行を削除
- **L50**: バッチ処理の説明から「Webhook再処理、Stripe同期」を除去

### 3-4: `docs/architecture/features/batch-processing.md`

- **L19**: ジョブ一覧テーブルの `history-cleanup` 説明を「古い履歴の削除（30日超過）」に変更
- **L21**: `webhook-retry` 行を削除
- **L22**: `payment-event-cleanup` 行を削除
- **L23**: `subscription-sync` 行を削除
- **L27**: `plan-distribution-aggregation` 行を削除
- **L41-43**: システム構成図からStripeを除去
- **L48-59**: エントリーポイントコードから `webhook-retry`, `payment-event-cleanup`, `subscription-sync`, `plan-distribution-aggregation` を削除
- **L68-85**: history-cleanup の説明を更新（「FREE プランユーザー」→「全ユーザー」、`PLAN_LIMITS.FREE.changeHistoryDays`→`HISTORY_RETENTION_DAYS`環境変数）
- **L87-137**: webhook-retry, payment-event-cleanup, subscription-sync の各セクション全体を削除
- **L196-217**: plan-distribution-aggregation セクション全体を削除
- **L227**: 依存関係から `src/lib/stripe.ts` を削除
- **L239**: 外部パッケージから `stripe` を削除
- **L238**: `@agentest/shared` の説明から「プラン制限等の」を除去
- **L262-264**: リトライ戦略テーブルから `webhook-retry`, `payment-event-cleanup`, `subscription-sync` を削除
- **L282**: STRIPE_SECRET_KEY 環境変数を削除
- **L288**: 関連ドキュメントから `課金システム(billing.md)` リンクを削除

### 3-5: `docs/architecture/features/admin-system.md`

- **L27**: 実装状況から「課金管理 🔲 未実装」行を削除
- **L57**: ダッシュボードの `ADM-MON-003 プラン別ユーザー分布` 行を削除
- **L74**: 組織詳細の説明から「サブスクリプション」を除去
- **L205**: ダッシュボードフローの「収益統計取得」行を削除
- **L236**: ユーザー詳細フローの「サブスクリプション情報取得」行を削除
- **L266**: 組織詳細フローの「サブスクリプション情報取得」行を削除
- **L509**: キャッシュ設定から `admin:metrics:plan-distribution:*` 行を削除
- **L529**: 関連機能から「管理者プラン分布メトリクス API」リンクを削除

---

## Phase 4: API リファレンスの更新

### 4-1: `docs/api/README.md`

- **L298-332**: 「課金・サブスクリプション」「組織課金・サブスクリプション」セクション全体を削除
- **L386**: レート制限テーブルから「課金 | 10 req / 1分」行を削除

---

## Phase 5: ガイド・運用ドキュメントの更新

### 5-1: `docs/guides/deployment.md`

- **L98**: Cloud Run Job 作成コマンドから `STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest` を除去
- **L110-112**: Cloud Scheduler 設定テーブルから `webhook-retry`, `payment-event-cleanup`, `subscription-sync` を削除
- **L125-153**: Cloud Scheduler の `webhook-retry`, `payment-event-cleanup`, `subscription-sync` 設定コマンドを削除

### 5-2: `docs/operations/batch-jobs-runbook.md`

- **L12**: スケジュール一覧の `history-cleanup` 説明を「古い履歴を削除」に変更
- **L14-16**: `webhook-retry`, `payment-event-cleanup`, `subscription-sync` 行を削除
- **L18**: `plan-distribution-aggregation` 行を削除
- **L83-95**: 手動実行セクションから `webhook-retry`, `payment-event-cleanup`, `subscription-sync` コマンドを削除
- **L112-115**: `plan-distribution-aggregation` 手動実行コマンドを削除
- **L152-184**: トラブルシューティングの「webhook-retry で最大リトライ回数」「subscription-sync で不一致」セクション全体を削除
- **L252-303**: データ確認クエリの「履歴クリーンアップ関連」を更新（FREEプラン参照を除去）、「Webhook 再処理関連」「サブスクリプション同期関連」「決済イベントクリーンアップ関連」を削除
- **L347-391**: 「プラン分布集計関連」クエリを削除
- **L421**: アラート設定から「Stripe 不一致検出」行を削除
- **L449**: 環境変数から `STRIPE_SECRET_KEY` 行を削除
- **L454**: 注記「subscription-sync には STRIPE_SECRET_KEY が必要」を削除

### 5-3: `docs/operations/runbook.md`

- **L288**: ユーザーサポート対応のSQLクエリから `o.plan` を除去
- **L443-448**: 手動実行の `webhook-retry` コマンドを削除

---

## Phase 6: トップレベルドキュメントの更新

### 6-1: `docs/README.md`

- **L3**: 「テスト管理ツール SaaS」→「テスト管理ツール」に変更

### 6-2: `CLAUDE.md`（プロジェクトルート）

- **L1**: 「テスト管理ツールSaaS」→「テスト管理ツール（OSS）」に変更

---

## Phase 7: 依存関係の削除

### 7-1: `apps/api/package.json`

- `stripe` パッケージを dependencies から削除
- `pnpm install` 実行

---

## 検証手順

```bash
# 1. 削除したドキュメントへのリンク切れチェック（billing.md, usage.md への参照が残っていないか）
grep -r "billing\.md" docs/ --include="*.md"
grep -r "usage\.md" docs/ --include="*.md"

# 2. 課金関連キーワードの残留チェック
grep -ri "stripe" docs/ --include="*.md"
grep -ri "SubscriptionPlan\|UserPlan\|OrganizationPlan" docs/ --include="*.md"
grep -ri "billingEmail\|paymentCustomerId" docs/ --include="*.md"
grep -ri "PLAN_LIMITS\|PLAN_PRICING" docs/ --include="*.md"

# 3. ビルド確認（stripe依存削除後）
docker compose exec dev pnpm install
docker compose exec dev pnpm build
docker compose exec dev pnpm test
```
