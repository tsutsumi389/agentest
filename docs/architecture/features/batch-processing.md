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
| `history-cleanup` | 毎日 3:00 JST | 古い履歴の削除（30日超過） |
| `project-cleanup` | 毎日 4:00 JST | ソフトデリート済みプロジェクトの物理削除 |
| `metrics-aggregation` | 毎日 1:00 JST | DAU/WAU/MAU集計 |
| `metrics-backfill` | 手動実行 | 過去メトリクスの一括集計 |

## アーキテクチャ

### システム構成

```
┌──────────────────┐     ┌──────────────────┐
│  Cloud Scheduler │────▶│  Cloud Run Jobs  │
│  (cron trigger)  │     │  (apps/jobs)     │
└──────────────────┘     └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             │
             ┌──────────┐  ┌──────────┐        │
             │PostgreSQL│  │  Redis   │        │
             │  (DB)    │  │ (Cache)  │        │
             └──────────┘  └──────────┘        │
```

### エントリーポイント

```typescript
// apps/jobs/src/index.ts
const jobs: Record<string, () => Promise<void>> = {
  'history-cleanup': runHistoryCleanup,
  'project-cleanup': runProjectCleanup,
  'metrics-aggregation': runMetricsAggregation,
  'metrics-backfill': runMetricsBackfill,
};

// JOB_NAME 環境変数で振り分け
const jobName = process.env.JOB_NAME;
await jobs[jobName]();
```

## ジョブ詳細

### 1. history-cleanup（履歴クリーンアップ）

古い変更履歴を削除します。

**処理フロー:**
```
1. 全ユーザーのプロジェクトを取得（バッチ100件）
2. 保持期間（HISTORY_RETENTION_DAYS 環境変数、デフォルト30日）を超えた履歴を削除
   - TestCaseHistory
   - TestSuiteHistory
   - ProjectHistory
3. 次のバッチへ
```

**定数:**
- `DEFAULT_BATCH_SIZE`: 100（1回のクエリで処理するユーザー数）
- `HISTORY_RETENTION_DAYS`: 30日（環境変数で設定可能）

### 2. project-cleanup（プロジェクトクリーンアップ）

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

### 3. metrics-aggregation（メトリクス集計）

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

### 4. metrics-backfill（メトリクスバックフィル）

過去データの一括集計用ジョブ。初期導入時や欠損データ補完に使用。

**処理フロー:**
```
1. 指定された期間の各日についてDAUを集計
2. 期間内の各週についてWAUを集計
3. 期間内の各月についてMAUを集計
```

**環境変数:**
- `BACKFILL_MONTHS`: 遡る月数（デフォルト: 3）

## 依存関係

### 共通ライブラリ

| ファイル | 役割 |
|---------|------|
| `src/lib/prisma.ts` | Prisma クライアント |
| `src/lib/redis.ts` | Redis クライアント |
| `src/lib/email.ts` | メール送信 |
| `src/lib/constants.ts` | 共通定数 |
| `src/lib/date-utils.ts` | JST日付計算ユーティリティ |
| `src/lib/metrics-utils.ts` | メトリクス集計ユーティリティ |

### 外部パッケージ

| パッケージ | 用途 |
|-----------|------|
| `@agentest/db` | Prisma スキーマ・クライアント |
| `@agentest/shared` | 共通定数 |
| `nodemailer` | メール送信 |
| `ioredis` | Redis クライアント |

## エラーハンドリング

### プロセスレベルの例外ハンドラ

`apps/jobs/src/index.ts` ではモジュールレベルで `uncaughtException` / `unhandledRejection` ハンドラを登録しています。
ジョブ実行中にキャッチされない例外が発生した場合：

1. 構造化JSON形式でエラーログを出力
2. ベストエフォートでPrisma/Redis接続をクリーンアップ（10秒タイムアウト）
3. exit code 1 で終了（Cloud Run Jobsがエラーとして記録）

これにより、Cloud Run Jobs のリトライポリシーと連携して自動復旧が可能です。

### リトライ戦略

| ジョブ | リトライ方式 |
|-------|-------------|
| `history-cleanup` | Cloud Scheduler の再スケジュール |
| `project-cleanup` | 個別プロジェクト単位でスキップして継続 |

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

## 関連ドキュメント

- [バッチジョブ運用ガイド](../../operations/batch-jobs-runbook.md) - 日常運用・トラブルシューティング
- [デプロイ手順](../../guides/deployment.md#cloud-run-jobs-バッチ処理) - デプロイ・設定
