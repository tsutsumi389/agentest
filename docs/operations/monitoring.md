# 監視・アラート設定ガイド

最終更新日: 2025年12月

## 1. 概要

本ドキュメントは、Agentestの監視体制とアラート設定について説明します。

## 2. 監視アーキテクチャ

```
┌──────────────────────────────────────────────────────────┐
│                     アプリケーション                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │   API   │ │   WS    │ │   Web   │ │  Admin  │       │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │
└───────┼───────────┼───────────┼───────────┼────────────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
┌──────────────────────────────────────────────────────────┐
│                    データ収集層                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Metrics   │  │    Logs     │  │   Traces    │     │
│  │  (Datadog)  │  │  (Logging)  │  │   (Trace)   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼────────────────┼────────────────┼─────────────┘
          │                │                │
          ▼                ▼                ▼
┌──────────────────────────────────────────────────────────┐
│                    分析・可視化                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Grafana / Datadog                   │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │Dashboard│ │ Alerts  │ │ Reports │           │    │
│  │  └─────────┘ └─────────┘ └─────────┘           │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────┐
│                    通知チャンネル                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │  Slack  │ │ PagerDuty│ │  Email  │ │ Webhook │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
└──────────────────────────────────────────────────────────┘
```

## 3. メトリクス

### 3.1 アプリケーションメトリクス

| メトリクス | 説明 | 収集間隔 |
|-----------|------|---------|
| `http_requests_total` | HTTPリクエスト総数 | 10秒 |
| `http_request_duration_seconds` | リクエスト処理時間 | 10秒 |
| `http_requests_in_flight` | 処理中リクエスト数 | 10秒 |
| `ws_connections_active` | アクティブWS接続数 | 10秒 |
| `db_pool_connections` | DB接続プール状態 | 30秒 |

### 3.2 ビジネスメトリクス

| メトリクス | 説明 | 収集間隔 |
|-----------|------|---------|
| `users_active_daily` | DAU | 1時間 |
| `test_executions_total` | テスト実行数 | 1分 |
| `mcp_sessions_active` | Agent接続数 | 1分 |
| `api_tokens_created` | APIトークン作成数 | 1時間 |

### 3.3 インフラメトリクス

| メトリクス | 説明 | 収集間隔 |
|-----------|------|---------|
| `cpu_utilization` | CPU使用率 | 60秒 |
| `memory_utilization` | メモリ使用率 | 60秒 |
| `disk_utilization` | ディスク使用率 | 5分 |
| `network_bytes_in/out` | ネットワークI/O | 60秒 |

## 4. ログ管理

### 4.1 ログレベル

| レベル | 用途 | 例 |
|--------|------|-----|
| `ERROR` | エラー、例外 | DB接続失敗、認証エラー |
| `WARN` | 警告 | レート制限到達、廃止API使用 |
| `INFO` | 重要イベント | ユーザー登録、デプロイ完了 |
| `DEBUG` | デバッグ情報 | リクエスト詳細（開発のみ） |

### 4.2 構造化ログフォーマット

```json
{
  "timestamp": "2025-12-26T10:00:00.000Z",
  "level": "ERROR",
  "service": "api",
  "traceId": "abc123",
  "userId": "user_xxx",
  "message": "Database connection failed",
  "error": {
    "name": "ConnectionError",
    "message": "ECONNREFUSED",
    "stack": "..."
  },
  "context": {
    "host": "db.agentest.io",
    "port": 5432
  }
}
```

### 4.3 プロセスレベル例外のログフォーマット

`uncaughtException` / `unhandledRejection` 発生時に出力されるログ:

```json
{
  "timestamp": "2025-12-26T10:00:00.000Z",
  "level": "error",
  "message": "キャッチされない例外が発生しました",
  "error": "Cannot read properties of undefined",
  "stack": "TypeError: Cannot read properties of undefined\n    at ..."
}
```

```json
{
  "timestamp": "2025-12-26T10:00:00.000Z",
  "level": "error",
  "message": "未処理のPromise拒否が発生しました",
  "reason": "Connection refused",
  "stack": "Error: Connection refused\n    at ..."
}
```

**監視での活用**: Cloud Logging でこれらのメッセージをフィルタし、アラートを設定することを推奨します。

```yaml
# アラートルール例
name: "Process Crash Detection"
filter: 'jsonPayload.message=~"キャッチされない例外|未処理のPromise拒否"'
severity: Critical
notification: "@slack-alerts @pagerduty-oncall"
```

### 4.3 ログ保持ポリシー

| ログ種別 | 保持期間 | 保存先 |
|---------|---------|--------|
| アプリケーションログ | 30日 | Cloud Logging |
| アクセスログ | 90日 | Cloud Logging |
| 監査ログ | 7年 | Cloud Storage (Archive) |
| セキュリティログ | 1年 | Cloud Logging + SIEM |

## 5. アラート設定

### 5.1 重大度定義

| 重大度 | 対応時間 | 通知先 | 例 |
|--------|---------|--------|-----|
| **Critical** | 即時 | PagerDuty + Slack | サービス停止、データ漏洩 |
| **High** | 15分 | Slack #alerts | エラー率急増、高負荷 |
| **Medium** | 1時間 | Slack #monitoring | パフォーマンス低下 |
| **Low** | 翌営業日 | Email | 警告、情報 |

### 5.2 アラートルール

#### 可用性アラート

| 条件 | 閾値 | 重大度 |
|------|------|--------|
| ヘルスチェック失敗 | 3回連続 | Critical |
| 5xxエラー率 | > 1% (5分平均) | High |
| 5xxエラー率 | > 5% (1分) | Critical |

```yaml
# Datadog Monitor例
name: "API 5xx Error Rate High"
type: metric alert
query: |
  sum(last_5m):sum:http.requests{service:api,status_code:5*}.as_count() /
  sum:http.requests{service:api}.as_count() * 100 > 1
message: |
  API 5xxエラー率が1%を超えています。

  現在値: {{value}}%
  ダッシュボード: https://app.datadoghq.com/dashboard/xxx

  @slack-alerts @pagerduty-oncall
thresholds:
  critical: 5
  warning: 1
```

#### パフォーマンスアラート

| 条件 | 閾値 | 重大度 |
|------|------|--------|
| レスポンスタイム (p95) | > 500ms | Medium |
| レスポンスタイム (p99) | > 1s | High |
| WebSocket遅延 | > 200ms | Medium |

```yaml
name: "API Latency P95 High"
type: metric alert
query: |
  avg(last_5m):p95:http.request.duration{service:api} > 0.5
message: |
  APIレスポンスタイム(p95)が500msを超えています。

  @slack-monitoring
thresholds:
  critical: 1
  warning: 0.5
```

#### リソースアラート

| 条件 | 閾値 | 重大度 |
|------|------|--------|
| CPU使用率 | > 80% (5分) | Medium |
| メモリ使用率 | > 85% | High |
| ディスク使用率 | > 80% | Medium |
| DB接続プール | > 80% | High |

#### セキュリティアラート

| 条件 | 閾値 | 重大度 |
|------|------|--------|
| 認証失敗 | > 100回/分 | High |
| 異常なAPIアクセス | 通常の10倍 | High |
| 権限昇格試行 | 1回 | Critical |

### 5.3 アラート抑制

```yaml
# メンテナンス時の抑制
downtimes:
  - name: "Monthly Maintenance"
    scope: "env:production"
    schedule:
      type: recurring
      rrule: "FREQ=MONTHLY;BYDAY=3SU"
      start: "02:00"
      duration: 14400  # 4時間
```

## 6. ダッシュボード

### 6.1 概要ダッシュボード

| パネル | 表示内容 |
|--------|---------|
| サービス状態 | 各サービスのヘルスステータス |
| エラー率 | 過去24時間のエラー率推移 |
| レスポンスタイム | p50, p95, p99の推移 |
| アクティブユーザー | 現在のアクティブセッション数 |

### 6.2 APIダッシュボード

| パネル | 表示内容 |
|--------|---------|
| リクエスト数 | エンドポイント別リクエスト数 |
| エラー分布 | ステータスコード別分布 |
| 遅いエンドポイント | レスポンスタイムTop10 |
| レート制限 | 429レスポンス数 |

### 6.3 データベースダッシュボード

| パネル | 表示内容 |
|--------|---------|
| 接続数 | アクティブ/アイドル接続 |
| クエリパフォーマンス | スロークエリ数 |
| レプリケーション遅延 | read replicaとの差分 |
| ディスク使用量 | テーブル別使用量 |

## 7. オンコール設定

### 7.1 ローテーション

```yaml
# PagerDuty設定
schedule:
  name: "Primary On-Call"
  time_zone: "Asia/Tokyo"
  rotation_virtual_start: "2025-01-01T09:00:00+09:00"
  rotation_turn_length_seconds: 604800  # 1週間
  users:
    - user_id: "P123ABC"
    - user_id: "P456DEF"
    - user_id: "P789GHI"
```

### 7.2 エスカレーションポリシー

```yaml
escalation_policy:
  name: "Production Incidents"
  rules:
    - targets:
        - type: schedule
          id: primary-oncall
      escalation_delay_in_minutes: 5
    - targets:
        - type: schedule
          id: secondary-oncall
      escalation_delay_in_minutes: 15
    - targets:
        - type: user
          id: tech-lead
      escalation_delay_in_minutes: 30
```

## 8. 合成監視

### 8.1 エンドポイント監視

| エンドポイント | 間隔 | タイムアウト | 場所 |
|---------------|------|------------|------|
| `/health` | 1分 | 10秒 | 東京, 大阪 |
| `/api/v1/me` | 5分 | 30秒 | 東京 |
| WebSocket接続 | 5分 | 30秒 | 東京 |

### 8.2 シナリオテスト

```yaml
# Datadog Synthetic Test
name: "User Login Flow"
type: browser
request:
  url: "https://app.agentest.io/login"
steps:
  - type: click
    element: "[data-testid=github-login]"
  - type: wait
    duration: 5000
  - type: assertElementContent
    element: "[data-testid=dashboard]"
    expectedContent: "ダッシュボード"
```

## 9. 実装例

### 9.1 Express メトリクスミドルウェア

```typescript
import { Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const path = req.route?.path || req.path;

    httpRequestsTotal.inc({
      method: req.method,
      path,
      status: res.statusCode,
    });

    httpRequestDuration.observe(
      { method: req.method, path },
      duration
    );
  });

  next();
};
```

### 9.2 構造化ロガー

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  mixin: () => ({
    service: 'api',
    environment: process.env.NODE_ENV,
  }),
});

// 使用例
logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ err, requestId }, 'Request failed');
```

---

## 関連ドキュメント

- [Runbook](./runbook.md)
- [インシデント対応](./incident-response.md)
- [SLA](./sla.md)
