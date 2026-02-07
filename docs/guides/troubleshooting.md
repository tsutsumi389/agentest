# トラブルシューティングガイド

よくある問題と解決方法をまとめたガイドです。

## 1. 開発環境の問題

### 1.1 Docker Compose が起動しない

**症状**: `docker compose up` でエラーが発生

**確認事項**:
```bash
# Dockerデーモンが起動しているか
docker info

# ポートが使用中でないか
lsof -i :3000
lsof -i :3001
lsof -i :5432
```

**解決策**:
```bash
# 1. 古いコンテナ・ボリュームを削除
docker compose down -v
docker system prune -f

# 2. 再ビルド
docker compose up --build
```

### 1.2 node_modules の同期問題

**症状**: パッケージが見つからない、型エラーが発生

**解決策**:
```bash
# ボリュームを削除して再インストール
docker compose down -v
docker compose --profile tools up -d dev
docker compose exec dev pnpm install
```

### 1.3 Prisma クライアントエラー

**症状**: `@prisma/client did not initialize yet`

**解決策**:
```bash
docker compose exec dev pnpm --filter @agentest/db prisma generate
```

### 1.4 マイグレーションエラー

**症状**: `Migration failed`

**確認事項**:
```bash
# マイグレーション状態確認
docker compose exec dev pnpm --filter @agentest/db prisma migrate status
```

**解決策**:
```bash
# 開発環境: DBをリセット（データ削除）
docker compose exec dev pnpm --filter @agentest/db prisma migrate reset

# 本番環境: 特定のマイグレーションを解決
docker compose exec dev pnpm --filter @agentest/db prisma migrate resolve --rolled-back MIGRATION_NAME
```

## 2. 認証の問題

### 2.1 OAuth ログインに失敗

**症状**: GitHubログインで「認証エラー」

**確認事項**:
1. OAuth アプリの設定を確認
   - GitHub: https://github.com/settings/developers
   - Callback URL が正しいか

2. 環境変数を確認
```bash
docker compose exec api env | grep GITHUB
```

**解決策**:
```bash
# .envファイルを確認・更新
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback
```

### 2.2 JWT トークンが無効

**症状**: `401 Unauthorized`、`Token expired`

**確認事項**:
```bash
# トークンの有効期限確認
# ブラウザのDevTools > Application > Cookies
```

**解決策**:
1. ログアウトして再ログイン
2. ブラウザのCookieをクリア
3. トークンリフレッシュエンドポイント呼び出し

### 2.3 CORS エラー

**症状**: `Access to fetch has been blocked by CORS policy`

**確認事項**:
```bash
# API の CORS 設定確認
docker compose exec api env | grep CORS
```

**解決策**:
```typescript
// apps/api/src/app.ts
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3003'],
  credentials: true,
}));
```

## 3. データベースの問題

### 3.1 接続できない

**症状**: `ECONNREFUSED`、`Connection refused`

**確認事項**:
```bash
# DBコンテナの状態確認
docker compose ps db

# 接続テスト
docker compose exec db pg_isready -U agentest
```

**解決策**:
```bash
# DBコンテナ再起動
docker compose restart db

# ログ確認
docker compose logs db
```

### 3.2 クエリが遅い

**症状**: API レスポンスが遅い

**確認事項**:
```sql
-- 実行中クエリ確認
SELECT pid, query, state, query_start
FROM pg_stat_activity
WHERE state = 'active';

-- スロークエリ確認
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

**解決策**:
```sql
-- インデックス追加
CREATE INDEX CONCURRENTLY idx_test_cases_project
ON test_cases(project_id);

-- VACUUM ANALYZE実行
VACUUM ANALYZE test_cases;
```

### 3.3 ディスク容量不足

**症状**: `No space left on device`

**確認事項**:
```bash
docker system df
docker volume ls
```

**解決策**:
```bash
# 未使用リソースを削除
docker system prune -a --volumes

# 特定ボリュームを削除
docker volume rm agentest_postgres_data
```

## 4. Redis の問題

### 4.1 接続できない

**確認事項**:
```bash
docker compose exec redis redis-cli -a agentest ping
```

**解決策**:
```bash
docker compose restart redis
```

### 4.2 メモリ不足

**症状**: `OOM command not allowed`

**確認事項**:
```bash
docker compose exec redis redis-cli -a agentest INFO memory
```

**解決策**:
```bash
# キャッシュクリア
docker compose exec redis redis-cli -a agentest FLUSHDB

# メモリ上限増加 (docker-compose.yml)
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

## 5. フロントエンドの問題

### 5.1 ページが表示されない

**症状**: 白い画面、ローディングが終わらない

**確認事項**:
```bash
# ブラウザのConsoleを確認
# Network タブでAPIリクエストを確認
```

**解決策**:
```bash
# 1. キャッシュクリア
docker compose exec web pnpm --filter @agentest/web clean

# 2. 再ビルド
docker compose restart web
```

### 5.2 HMR（ホットリロード）が効かない

**症状**: ファイル変更が反映されない

**確認事項**:
- ファイルがボリュームマウントされているか
- WSL2の場合、ファイルシステムの問題

**解決策**:
```yaml
# docker-compose.override.yml
web:
  environment:
    CHOKIDAR_USEPOLLING: "true"
    WATCHPACK_POLLING: "true"
```

### 5.3 型エラー

**症状**: TypeScript のコンパイルエラー

**解決策**:
```bash
# 型定義の再生成
docker compose exec dev pnpm --filter @agentest/db prisma generate
docker compose exec dev pnpm build --filter @agentest/shared
```

## 6. WebSocket の問題

### 6.1 接続できない

**症状**: WebSocket connection failed

**確認事項**:
```bash
# WSサーバーの状態確認
docker compose logs ws

# 接続テスト
websocat ws://localhost:3002
```

**解決策**:
```bash
docker compose restart ws
```

### 6.2 接続が頻繁に切れる

**症状**: 定期的に再接続が発生

**確認事項**:
- ハートビート設定
- プロキシのタイムアウト設定

**解決策**:
```typescript
// クライアント側でハートビート実装
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

## 7. API の問題

### 7.1 レート制限に引っかかる

**症状**: `429 Too Many Requests`

**確認事項**:
```bash
# レスポンスヘッダー確認
curl -I https://api.agentest.io/health
# X-RateLimit-Remaining を確認
```

**解決策**:
1. リクエスト間隔を空ける
2. バッチリクエストを使用
3. 上位プランへアップグレード

### 7.2 タイムアウト

**症状**: `504 Gateway Timeout`

**確認事項**:
```bash
# API ログ確認
docker compose logs -f api

# 遅いエンドポイント特定
```

**解決策**:
```bash
# クエリ最適化
# バッチ処理の分割
# タイムアウト設定の調整
```

## 8. 本番環境の問題

### 8.1 デプロイに失敗

**症状**: CI/CD パイプラインでエラー

**確認事項**:
```bash
# GitHub Actions ログ確認
gh run view RUN_ID --log

# Cloud Build ログ確認
gcloud builds log BUILD_ID
```

**解決策**:
```bash
# 手動デプロイ
gcloud run deploy agentest-api \
  --image=gcr.io/PROJECT/agentest-api:latest \
  --region=asia-northeast1
```

### 8.2 メモリ不足

**症状**: コンテナが再起動する、OOM Killed

**確認事項**:
```bash
# Cloud Run メトリクス確認
gcloud monitoring metrics list --filter="metric.type=run.googleapis.com/container/memory"
```

**解決策**:
```bash
# メモリ上限を増加
gcloud run services update agentest-api \
  --memory=1Gi
```

## 9. プロセスクラッシュ（未処理例外）

### 9.1 uncaughtException / unhandledRejection

**症状**: サーバーが予期せず再起動する、ログに「キャッチされない例外」「未処理のPromise拒否」が出力される

**ログの確認**:
```bash
# ローカル環境
docker compose logs api 2>&1 | grep -E "キャッチされない例外|未処理のPromise拒否"

# JSON形式のエラーログが出力される
# {"timestamp":"...","level":"error","message":"キャッチされない例外が発生しました","error":"...","stack":"..."}
```

**確認事項**:
1. `stack` フィールドからエラーの発生箇所を特定
2. 同時刻のリクエストログから原因となったリクエストを特定
3. exit code 1 で終了しているか確認（異常終了の証拠）

**よくある原因**:
- `await` の付け忘れによる未処理のPromise拒否
- try-catchで囲まれていない非同期処理
- EventEmitterの `error` イベント未ハンドリング
- 外部サービス（DB, Redis）の予期しない切断

**解決策**:
1. スタックトレースから該当コードを修正
2. 非同期処理に適切なエラーハンドリングを追加
3. 頻発する場合はロールバックを検討

### 9.2 graceful shutdown のタイムアウト

**症状**: ログに「タイムアウト: 強制終了します」が出力される

**原因**: シャットダウン処理が10秒以内に完了しなかった

**確認事項**:
- 長時間実行中のリクエストが残っていないか
- DB/Redisへの接続クローズがハングしていないか

## 10. よくあるエラーメッセージ

| エラー | 原因 | 解決策 |
|--------|------|--------|
| `ECONNREFUSED` | サービス未起動 | `docker compose up` |
| `ENOTFOUND` | DNS解決失敗 | ホスト名確認 |
| `ETIMEDOUT` | 接続タイムアウト | ネットワーク確認 |
| `EACCES` | 権限不足 | `chmod` / `chown` |
| `ENOMEM` | メモリ不足 | リソース解放 |
| `P2002` | 一意制約違反 | 重複データ確認 |
| `P2025` | レコード未存在 | ID確認 |

## 11. ログの確認方法

バックエンドサービスは Pino による構造化JSONログを出力します。

### 基本コマンド

```bash
# 全サービスのログ
docker compose logs -f

# 特定サービス、直近100行
docker compose logs -f --tail=100 api

# 時間指定
docker compose logs --since="2025-12-26T10:00:00" api
```

### 構造化ログのフィルタリング

ログはJSON形式で出力されるため、`jq` を使ってフィルタリング・整形できます。

```bash
# エラーレベルのみ抽出
docker compose logs api 2>&1 | grep '"level":"error"'

# jq で整形表示
docker compose logs api --no-log-prefix 2>&1 | jq -r 'select(.level == "error")'

# 特定モジュールのログを抽出
docker compose logs api --no-log-prefix 2>&1 | jq -r 'select(.module == "events")'

# エラーのスタックトレースを表示
docker compose logs api --no-log-prefix 2>&1 | jq -r 'select(.err) | "\(.time) [\(.level)] \(.msg)\n\(.err.stack)"'
```

### ログ出力フォーマット

```json
{
  "level": "info",
  "time": "2025-12-26T10:00:00.000Z",
  "service": "api",
  "env": "development",
  "module": "events",
  "msg": "イベントを処理しました"
}
```

### 開発時の可読表示

`LOG_PRETTY=true` 環境変数を設定すると、pino-pretty による色付き可読フォーマットで出力されます。

```bash
# docker-compose.override.yml で設定
api:
  environment:
    LOG_PRETTY: "true"
```

---

## 関連ドキュメント

- [初回セットアップ](./getting-started.md)
- [開発フロー](./development.md)
- [Runbook](../operations/runbook.md)
- [インシデント対応](../operations/incident-response.md)
