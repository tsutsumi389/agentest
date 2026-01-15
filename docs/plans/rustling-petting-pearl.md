# APIレート制限見直しプラン

## 決定事項
- apiLimiterを15分100リクエスト → **15分300リクエスト**に緩和

## 現状分析

### 現在の設定
- `apiLimiter`: **15分で100リクエスト/IP** (`/api/*` に適用)
- `authLimiter`: 1時間で10リクエスト/IP (認証用)
- `strictLimiter`: 1時間で3リクエスト/IP (厳格)
- `/internal/api/*`: レート制限なし（MCPサーバー用）

### 問題
- Webフロント併用時に15分で100リクエストを超過
- MCPサーバー自体は内部APIを使用しているため直接の原因ではない
- 同一IPからのWebフロントリクエストがカウントされている

## 推奨アプローチ: apiLimiterの制限値を緩和

### 変更内容

**ファイル**: `apps/api/src/middleware/rate-limiter.ts`

```typescript
// 変更前
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // IP毎に100リクエスト
  ...
});

// 変更後
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 300, // IP毎に300リクエスト（3倍に緩和）
  ...
});
```

### 理由
- 100→300に緩和（3倍）
- SPAの通常使用で1分あたり約5-10リクエスト発生する想定
- 15分で75-150リクエスト → 余裕を持たせて300に設定
- DDoS対策としての効果は維持（異常なアクセスはブロック）

## 検証方法

1. Docker環境を再起動
2. WebフロントとMCPクライアントを併用
3. 15分間連続操作してレート制限にかからないことを確認
4. `RateLimit-Remaining` ヘッダーで残りリクエスト数を確認可能
