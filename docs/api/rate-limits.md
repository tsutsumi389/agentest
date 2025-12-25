# API レート制限

Agentestでは、サービスの安定性と公平な利用を確保するため、APIリクエストにレート制限を設けています。

## 概要

レート制限は、一定時間内に許可されるAPIリクエスト数の上限です。制限を超えた場合、`429 Too Many Requests`エラーが返されます。

## プラン別制限

### リクエスト制限

| プラン | リクエスト/分 | リクエスト/時 | リクエスト/日 |
|--------|--------------|--------------|--------------|
| Free | 60 | 1,000 | 10,000 |
| Pro | 300 | 10,000 | 100,000 |
| Team | 600 | 30,000 | 300,000 |
| Enterprise | カスタム | カスタム | カスタム |

### エンドポイント別制限

一部のエンドポイントには追加の制限があります。

| エンドポイント | 制限 | 理由 |
|---------------|------|------|
| `POST /auth/*` | 5/分 | ブルートフォース防止 |
| `POST /executions` | 10/分 | リソース保護 |
| `POST /mcp/*` | 30/分 | Agent連携制御 |
| `GET /export/*` | 5/分 | 負荷軽減 |

## レスポンスヘッダー

すべてのAPIレスポンスには、レート制限に関するヘッダーが含まれます。

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1703577600
Retry-After: 30
```

| ヘッダー | 説明 |
|---------|------|
| `X-RateLimit-Limit` | 時間枠内の最大リクエスト数 |
| `X-RateLimit-Remaining` | 残りリクエスト数 |
| `X-RateLimit-Reset` | 制限がリセットされるUNIXタイムスタンプ |
| `Retry-After` | 再試行までの推奨秒数（429時のみ） |

## エラーレスポンス

制限を超えた場合のレスポンス:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "リクエスト制限を超えました。しばらく待ってから再試行してください。",
    "retryAfter": 30
  }
}
```

## ベストプラクティス

### 1. 指数バックオフの実装

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
      // 指数バックオフ: 1回目30秒、2回目60秒、3回目120秒
      const delay = retryAfter * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      continue;
    }

    return response;
  }
  throw new Error('レート制限により最大リトライ回数を超えました');
}
```

### 2. リクエストのバッチ処理

複数のリソースを取得する場合、個別リクエストではなくバッチエンドポイントを使用してください。

```typescript
// 非推奨: 個別リクエスト
for (const id of ids) {
  await fetch(`/api/v1/test-cases/${id}`);
}

// 推奨: バッチリクエスト
await fetch('/api/v1/test-cases', {
  method: 'POST',
  body: JSON.stringify({ ids })
});
```

### 3. キャッシュの活用

頻繁に変更されないデータはクライアント側でキャッシュしてください。

```typescript
// ETags を使用した条件付きリクエスト
const response = await fetch('/api/v1/projects', {
  headers: {
    'If-None-Match': cachedETag
  }
});

if (response.status === 304) {
  // キャッシュを使用
  return cachedData;
}
```

### 4. WebSocket の活用

リアルタイム更新が必要な場合、ポーリングではなくWebSocket接続を使用してください。

```typescript
// 非推奨: ポーリング
setInterval(() => fetch('/api/v1/executions/status'), 1000);

// 推奨: WebSocket
const ws = new WebSocket('wss://api.agentest.io/ws');
ws.onmessage = (event) => handleUpdate(JSON.parse(event.data));
```

## 制限の引き上げ

### 一時的な引き上げ

大規模なデータ移行やイベント時に一時的な制限引き上げが必要な場合、事前にサポートへご連絡ください。

### 恒久的な引き上げ

- **Enterpriseプラン**: カスタム制限を設定可能です。
- **その他のプラン**: 上位プランへのアップグレードをご検討ください。

## MCP (Agent連携) の制限

Coding Agent（Claude Code等）からの連携には、通常のAPI制限に加えて以下の制限があります。

| 項目 | 制限 |
|------|------|
| 同時セッション数 | 5（Team）/ 無制限（Enterprise） |
| セッション時間 | 最大4時間 |
| ハートビート間隔 | 30秒 |

## 監視とアラート

レート制限の状況は、ダッシュボードの「使用状況」セクションで確認できます。

- 現在の使用率
- 過去7日間のトレンド
- 制限到達のアラート設定

## 関連ドキュメント

- [API認証](./auth.md)
- [エラーハンドリング](../architecture/api-design.md#エラーハンドリング)
- [SLA](../operations/sla.md)
