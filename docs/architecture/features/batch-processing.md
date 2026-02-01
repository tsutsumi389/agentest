# バッチ処理アーキテクチャ

## 概要

`apps/jobs` はバッチ処理を行う Cloud Run Jobs アプリケーションです。
Cloud Scheduler と連携し、定期的なデータメンテナンスやシステム連携処理を自動実行します。

## 設計方針

- **シンプルなエントリーポイント**: `JOB_NAME` 環境変数でジョブを振り分け
- **べき等性**: 同じジョブを複数回実行しても安全
- **バッチ処理**: カーソルベースのページネーションで大量データを効率的に処理
- **リソース管理**: 処理完了後に Prisma/Redis 接続を確実にクローズ

## ジョブ一覧

| ジョブ名 | 実行タイミング | 目的 |
|---------|---------------|------|
| `history-cleanup` | 毎日 3:00 JST | FREE プラン履歴の削除 |
| `project-cleanup` | 毎日 4:00 JST | ソフトデリート済みプロジェクトの物理削除 |
| `webhook-retry` | 毎時 0分 | 失敗 Webhook の再処理 |
| `payment-event-cleanup` | 毎週日曜 4:00 JST | 古い決済イベントの削除 |
| `subscription-sync` | 毎週日曜 5:00 JST | Stripe との状態同期 |
| `metrics-aggregation` | 毎日 1:00 JST | DAU/WAU/MAU集計 |
| `metrics-backfill` | 手動実行 | 過去メトリクスの一括集計 |
| `plan-distribution-aggregation` | 毎日 0:05 JST | プラン分布集計 |

## アーキテクチャ

### システム構成

```
┌──────────────────┐     ┌──────────────────┐
│  Cloud Scheduler │────▶│  Cloud Run Jobs  │
│  (cron trigger)  │     │  (apps/jobs)     │
└──────────────────┘     └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             ┌──────────┐  ┌──────────┐  ┌──────────┐
             │PostgreSQL│  │  Redis   │  │  Stripe  │
             │  (DB)    │  │ (Cache)  │  │  (API)   │
             └──────────┘  └──────────┘  └──────────┘
```

### エントリーポイント

```typescript
// apps/jobs/src/index.ts
const jobs: Record<string, () => Promise<void>> = {
  'history-cleanup': runHistoryCleanup,
  'project-cleanup': runProjectCleanup,
  'webhook-retry': runWebhookRetry,
  'payment-event-cleanup': runPaymentEventCleanup,
  'subscription-sync': runSubscriptionSync,
  'metrics-aggregation': runMetricsAggregation,
  'metrics-backfill': runMetricsBackfill,
  'plan-distribution-aggregation': runPlanDistributionAggregation,
};

// JOB_NAME 環境変数で振り分け
const jobName = process.env.JOB_NAME;
await jobs[jobName]();
```

## ジョブ詳細

### 1. history-cleanup（履歴クリーンアップ）

FREE プランユーザーの古い変更履歴を削除します。

**処理フロー:**
```
1. FREE プランユーザーを取得（バッチ100件）
2. 各ユーザーが所有する個人プロジェクトを特定
3. 保持期間（30日）を超えた履歴を削除
   - TestCaseHistory
   - TestSuiteHistory
   - ProjectHistory
4. 次のバッチへ
```

**定数:**
- `DEFAULT_BATCH_SIZE`: 100（1回のクエリで処理するユーザー数）
- `PLAN_LIMITS.FREE.changeHistoryDays`: 30日（FREE プランの履歴保持日数）

### 2. webhook-retry（Webhook 再処理）

処理に失敗した決済 Webhook イベントを再処理します。

**処理フロー:**
```
1. FAILED ステータスでリトライ回数 < 5 のイベントを取得
2. イベントタイプに応じた処理を実行
   - invoice.paid: 請求書支払い完了
   - invoice.payment_failed: 支払い失敗
   - customer.subscription.created: サブスクリプション作成
   - customer.subscription.updated: サブスクリプション更新
   - customer.subscription.deleted: サブスクリプション削除
3. 成功: PROCESSED に更新
4. 失敗: retryCount をインクリメント
```

**定数:**
- `MAX_RETRY_COUNT`: 5（最大リトライ回数）
- `DEFAULT_BATCH_SIZE`: 100（1回で処理するイベント数）

### 3. payment-event-cleanup（決済イベントクリーンアップ）

古い決済イベントレコードを削除します。

**処理フロー:**
```
1. 90日以上前の PROCESSED イベントを削除
2. 90日以上前でリトライ上限到達の FAILED イベントを削除
3. 残りのイベント数をレポート
```

**定数:**
- `PAYMENT_EVENT_RETENTION_DAYS`: 90日

### 4. subscription-sync（サブスクリプション同期）

DB と Stripe の状態整合性をチェックします。

**処理フロー:**
```
1. externalId が設定されたサブスクリプションを取得
2. Stripe API でサブスクリプション情報を照会
3. ステータスの不一致を検出・更新
4. 期間終了日の不一致（1日以上）を検出・更新
5. Stripe で見つからないサブスクリプションを CANCELED に
```

**チェック項目:**
- ステータス（ACTIVE, PAST_DUE, CANCELED, TRIALING）
- 期間終了日（1日以上のずれ）

### 5. project-cleanup（プロジェクトクリーンアップ）

ソフトデリートから30日以上経過したプロジェクトを物理削除します。

**処理フロー:**
```
1. 削除対象件数を事前にレポート
2. deletedAt が 30日以上前のプロジェクトを取得（バッチ100件）
3. 各プロジェクトを物理削除（カスケードで関連データも削除）
4. 次のバッチへ
5. 残りのソフトデリート済みプロジェクト数をレポート
```

**カスケード削除対象:**
- ProjectMember, ProjectEnvironment, ProjectHistory
- AgentSession, Label
- TestSuite → TestCase → TestCaseStep, TestCaseExpectedResult, TestCasePrecondition
- Execution → ExecutionTestCase, ExecutionStepResult, ExecutionEvidence等

**定数:**
- `PROJECT_CLEANUP_DAYS`: 30日（物理削除までの保持日数）
- `DEFAULT_BATCH_SIZE`: 100（1回のクエリで処理するプロジェクト数）

### 6. metrics-aggregation（メトリクス集計）

DAU/WAU/MAUを集計して `active_user_metrics` テーブルに保存します。

**処理フロー:**
```
1. 前日のDAUを集計（毎日実行）
2. 月曜日の場合、前週のWAUを集計
3. 月初の場合、前月のMAUを集計
4. 結果を active_user_metrics テーブルにupsert
```

**集計条件:**
- `Session.revokedAt` が NULL
- `Session.lastActiveAt` が対象期間内
- `User.deletedAt` が NULL

**定数:**
- 実行時刻: 毎日 1:00 JST

### 7. metrics-backfill（メトリクスバックフィル）

過去データの一括集計用ジョブ。初期導入時や欠損データ補完に使用。

**処理フロー:**
```
1. 指定された期間の各日についてDAUを集計
2. 期間内の各週についてWAUを集計
3. 期間内の各月についてMAUを集計
```

**環境変数:**
- `BACKFILL_MONTHS`: 遡る月数（デフォルト: 3）

### 8. plan-distribution-aggregation（プラン分布集計）

プラン別ユーザー・組織分布を集計して `plan_distribution_metrics` テーブルに保存します。

**処理フロー:**
```
1. ユーザープラン分布を集計（FREE, PRO）
2. 組織プラン分布を集計（TEAM, ENTERPRISE）
3. 各プランの組織メンバー数を集計
4. 結果を plan_distribution_metrics テーブルにupsert
```

**集計条件:**
- ユーザー: `Subscription.plan`（なければFREE）、`status = 'ACTIVE'`
- 組織: `Subscription.plan`（なければTEAM）、`status = 'ACTIVE'`
- `User.deletedAt = NULL`、`Organization.deletedAt = NULL`

**定数:**
- 実行時刻: 毎日 0:05 JST
- DAY: 毎日実行（前日分）
- WEEK: 月曜日に実行（前週分）
- MONTH: 月初に実行（前月分）

## 依存関係

### 共通ライブラリ

| ファイル | 役割 |
|---------|------|
| `src/lib/prisma.ts` | Prisma クライアント |
| `src/lib/redis.ts` | Redis クライアント |
| `src/lib/stripe.ts` | Stripe クライアント |
| `src/lib/email.ts` | メール送信 |
| `src/lib/constants.ts` | 共通定数 |
| `src/lib/date-utils.ts` | JST日付計算ユーティリティ |
| `src/lib/metrics-utils.ts` | メトリクス集計ユーティリティ |

### 外部パッケージ

| パッケージ | 用途 |
|-----------|------|
| `@agentest/db` | Prisma スキーマ・クライアント |
| `@agentest/shared` | プラン制限等の共通定数 |
| `stripe` | Stripe API クライアント |
| `nodemailer` | メール送信 |
| `ioredis` | Redis クライアント |

## エラーハンドリング

### リトライ戦略

| ジョブ | リトライ方式 |
|-------|-------------|
| `history-cleanup` | Cloud Scheduler の再スケジュール |
| `project-cleanup` | 個別プロジェクト単位でスキップして継続 |
| `webhook-retry` | PaymentEvent の retryCount で管理 |
| `payment-event-cleanup` | Cloud Scheduler の再スケジュール |
| `subscription-sync` | 個別サブスクリプション単位でスキップして継続 |

### ログ出力

すべてのジョブで以下の情報をログ出力します：

- ジョブ開始時刻
- 処理件数
- エラー詳細
- ジョブ終了時刻・所要時間

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `JOB_NAME` | Yes | 実行するジョブ名 |
| `DATABASE_URL` | Yes | PostgreSQL 接続文字列 |
| `REDIS_URL` | Yes | Redis 接続文字列 |
| `STRIPE_SECRET_KEY` | No* | Stripe API キー（subscription-sync で必要） |

## 関連ドキュメント

- [バッチジョブ運用ガイド](../../operations/batch-jobs-runbook.md) - 日常運用・トラブルシューティング
- [デプロイ手順](../../guides/deployment.md#cloud-run-jobs-バッチ処理) - デプロイ・設定
- [課金システム](./billing.md) - 決済・サブスクリプション
