# MCPセッション再起動耐性の改善

## 課題

GitHub Issue: #262

MCPサーバー（`apps/mcp-server`）のセッションがインメモリ `Map` に保持されているため、以下のシナリオでセッションが消滅し、クライアント（Claude Code）が `-32600` エラーで復旧できない。

**開発環境:**
- `tsx watch` によるホットリロード（コード変更の都度）
- Dockerコンテナの再起動

**本番環境（Cloud Run）:**
- オートスケールによるインスタンス増減
- リクエストが別インスタンスにルーティングされる
- スケールインによるインスタンス停止
- コールドスタート時のセッション不在

### エラーメッセージ

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "セッションが見つかりません。initializeリクエストから開始してください。"
  }
}
```

### 根本原因

`apps/mcp-server/src/transport/streamable-http.ts:30`:

```typescript
const transports = new Map<string, StreamableHTTPServerTransport>();
```

`StreamableHTTPServerTransport` インスタンスはシリアライズ不可（SDK制約）のため、インスタンス間でのセッション共有やサーバー再起動後のセッション復旧は不可能。

---

## アーキテクチャ

### セッション3層モデル

| 層 | 保存先 | データ | 寿命 | 用途 |
|---|--------|--------|------|------|
| **MCPトランスポート** | インメモリ Map | `StreamableHTTPServerTransport` | プロセス生存中 | SDK必須。リクエスト処理に不可欠。シリアライズ不可 |
| **セッションルーティング** | Redis | セッション→インスタンスIDマッピング + メタデータ | TTL 180秒 | どのインスタンスがセッションを保持しているか判定 |
| **AgentSession** | PostgreSQL（既存） | ステータス, ハートビート, プロジェクト紐付け | 永続 | ビジネスロジック。エージェント活動の追跡 |

### エラー判定フロー

```
リクエスト受信 (インスタンスA)
  ├─ インメモリにセッションあり → 正常処理
  └─ インメモリにセッションなし
       └─ Redis参照
            ├─ Redisにもなし → "session_not_found"
            ├─ Redisにあり & 同じインスタンスID → "server_restarted"
            └─ Redisにあり & 別のインスタンスID
                 ├─ そのインスタンスが生存 → "wrong_instance"
                 └─ そのインスタンスが死亡 → "instance_terminated"
```

### Cloud Run セッションアフィニティ

Cloud Runの `sessionAffinity: true` を有効にし、同一クライアントのリクエストを同一インスタンスにルーティングする。ただしベストエフォートのため、Redis層での検知は必須。

---

## Phase 1: 短期対策（エラー改善 + マルチインスタンス対応基盤）

### Step 1-1: サーバーインスタンスID管理の導入

**ファイル**: `apps/mcp-server/src/lib/server-instance.ts` (新規)

プロセス起動ごとに一意のインスタンスIDを生成し、Redisに登録する。インスタンスの生存確認にも使用。

```typescript
import { randomUUID } from 'crypto';
import { getRedisClient } from './redis.js';

const SERVER_INSTANCE_ID = randomUUID();
const REDIS_KEY_PREFIX = 'mcp:instance:';
const INSTANCE_TTL_SECONDS = 120; // 2分（ハートビート間隔30秒の4倍）

export function getServerInstanceId(): string {
  return SERVER_INSTANCE_ID;
}

/**
 * インスタンスをRedisに登録
 * 定期的にTTLを延長することで生存を表明する
 */
export async function registerServerInstance(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.setex(
    `${REDIS_KEY_PREFIX}${SERVER_INSTANCE_ID}`,
    INSTANCE_TTL_SECONDS,
    JSON.stringify({ startedAt: new Date().toISOString() })
  );
}

/**
 * インスタンスのTTLを延長（ハートビートで呼び出し）
 */
export async function refreshInstanceHeartbeat(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.expire(`${REDIS_KEY_PREFIX}${SERVER_INSTANCE_ID}`, INSTANCE_TTL_SECONDS);
}

/**
 * 指定インスタンスが生存しているか確認
 */
export async function isInstanceAlive(instanceId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  const exists = await redis.exists(`${REDIS_KEY_PREFIX}${instanceId}`);
  return exists === 1;
}
```

**依存**: なし
**リスク**: Low（Redis未設定時はフォールバック）

---

### Step 1-2: セッションメタデータのRedisストア

**ファイル**: `apps/mcp-server/src/lib/session-store.ts` (新規)

セッション→インスタンスIDのマッピングとメタデータをRedisに保存する。既存の `token-cache.ts` パターンに準拠。

```typescript
const KEY_PREFIX = 'mcp:session:';
const SESSION_TTL_SECONDS = 180; // ハートビートタイムアウト(60s)の3倍

interface StoredSessionData {
  userId: string;
  instanceId: string;
  createdAt: string;
}
```

提供する関数:

| 関数 | 説明 |
|------|------|
| `saveSession(sessionId, data)` | セッションメタデータ + インスタンスIDをRedisに保存 |
| `getSession(sessionId)` | セッションメタデータを取得（インスタンスID含む） |
| `deleteSession(sessionId)` | セッションメタデータを削除 |
| `refreshSessionTtl(sessionId)` | セッションのTTLを延長（リクエスト毎） |

**依存**: Step 1-1
**リスク**: Low（Redis未接続時は各関数が即returnし、現行動作を維持）

---

### Step 1-3: エラーレスポンスの改善とマルチインスタンス対応

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts` (変更)

#### 変更内容

1. **セッション作成時**: Redisへメタデータを保存
2. **セッション削除時**: Redisからもメタデータを削除
3. **リクエスト処理時**: RedisセッションTTLを延長
4. **無効セッションIDのリクエスト時**: Redisを参照して原因を区別

#### エラーレスポンスの改善

全パターンに `data.reinitialize: true` を付与し、クライアントの自動再接続の足がかりとする。

| 原因 | `data.reason` | メッセージ |
|------|--------------|-----------|
| セッション不明 | `session_not_found` | セッションが見つかりません。initializeリクエストから開始してください。 |
| プロセス再起動 | `server_restarted` | セッションが無効です。サーバーが再起動されたため、再初期化してください。 |
| 別インスタンスが保持 | `wrong_instance` | セッションは別のインスタンスに存在します。再初期化してください。 |
| インスタンス停止 | `instance_terminated` | セッションを保持していたインスタンスが停止しました。再初期化してください。 |

#### 判定ロジック

```typescript
async function resolveSessionError(
  sessionId: string | undefined,
  body: JsonRpcRequest,
  res: Response
): Promise<void> {
  let reason = 'session_not_found';
  let message = 'セッションが見つかりません。initializeリクエストから開始してください。';

  if (sessionId) {
    const stored = await getSession(sessionId);
    if (stored) {
      if (stored.instanceId === getServerInstanceId()) {
        // 同じインスタンスなのにインメモリにない → プロセス再起動
        reason = 'server_restarted';
        message = 'セッションが無効です。サーバーが再起動されたため、再初期化してください。';
      } else if (await isInstanceAlive(stored.instanceId)) {
        // 別インスタンスが生きている → ルーティングミス
        reason = 'wrong_instance';
        message = 'セッションは別のインスタンスに存在します。再初期化してください。';
      } else {
        // 別インスタンスが死んでいる → スケールイン
        reason = 'instance_terminated';
        message = 'セッションを保持していたインスタンスが停止しました。再初期化してください。';
      }
      // 使えないセッションをRedisから削除
      await deleteSession(sessionId);
    }
  }

  res.status(400).json({
    jsonrpc: '2.0',
    error: {
      code: -32600,
      message,
      data: { reason, reinitialize: true },
    },
    id: body?.id ?? null,
  });
}
```

**依存**: Step 1-1, Step 1-2
**リスク**: Medium（`error.data` はJSON-RPCオプショナルフィールドなので既存パースを破壊しない）

---

### Step 1-4: `deleteSession` / `cleanupAllSessions` のRedis連動

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts` (変更)

既存ユーティリティ関数でRedisからもデータを削除するよう修正。グレースフルシャットダウン時にRedisの孤立データを防ぐ。

**依存**: Step 1-2
**リスク**: Low

---

### Step 1-5: HeartbeatServiceの拡張

**ファイル**: `apps/mcp-server/src/services/heartbeat.service.ts` (変更)

定期チェックに以下を追加:

1. **インスタンスTTL延長**: `refreshInstanceHeartbeat()` を呼び出し、自インスタンスの生存をRedisに表明
2. **孤立セッションクリーンアップ**: DB上のACTIVEセッションでインスタンスが死亡しているものを検知・処理

```typescript
private async checkTimeouts(): Promise<void> {
  // 既存: DBのタイムアウトセッション処理
  await agentSessionService.processTimedOutSessions();

  // 追加: 自インスタンスの生存表明
  await refreshInstanceHeartbeat();
}
```

**依存**: Step 1-1
**リスク**: Low

---

### Step 1-6: サーバー起動シーケンスの更新

**ファイル**: `apps/mcp-server/src/index.ts` (変更)

`main()` 関数にインスタンス登録を追加。

```typescript
async function main() {
  await prisma.$connect();

  // サーバーインスタンスをRedisに登録
  await registerServerInstance();

  const app = createApp();

  heartbeatService.start();
  // ... (以降は既存コード)
}
```

**依存**: Step 1-1
**リスク**: Low

---

## Phase 2: 中期対策（監視強化 + 運用改善）

### Step 2-1: ヘルスチェックエンドポイントの拡張

**ファイル**: `apps/mcp-server/src/app.ts` (変更)

`/health` にインスタンスIDとアクティブセッション数を追加。

```json
{
  "status": "ok",
  "service": "mcp-server",
  "instanceId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "activeSessions": 3
}
```

**依存**: Step 1-1
**リスク**: Low

---

### Step 2-2: 再初期化時のセッション引き継ぎログ

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts` (変更)

`initialize` リクエスト時に `mcp-session-id` ヘッダーが付いている場合（再初期化）、前回セッション情報をログに記録。

```typescript
if (sessionId) {
  logger.info(
    { oldSessionId: sessionId, newSessionId },
    'クライアントが再初期化しました（前回セッションから復帰）'
  );
}
```

**依存**: Step 1-3
**リスク**: Low

---

### Step 2-3: Cloud Runセッションアフィニティ設定

**ファイル**: Cloud Run サービス設定（IaC / コンソール）

```yaml
# Cloud Run service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: agentest-mcp
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/sessionAffinity: "true"
```

セッションアフィニティを有効にし、同一クライアントからのリクエストを同一インスタンスにルーティング（ベストエフォート）。

**依存**: なし
**リスク**: Low（ベストエフォートのため、Phase 1のRedis層が必須の補完）

---

### Step 2-4: HeartbeatServiceにインメモリ-Redis整合性チェックを追加

**ファイル**: `apps/mcp-server/src/services/heartbeat.service.ts` (変更)

定期チェック時にインメモリセッション数をdebugログに出力し、運用監視を可能にする。

**依存**: Step 1-3
**リスク**: Low

---

## Redisキー設計

```
mcp:instance:{instanceId}            → インスタンス情報 (STRING, TTL: 120s, ハートビートで延長)
mcp:session:{sessionId}              → セッションメタデータ JSON (STRING, TTL: 180s, リクエスト毎に延長)
```

格納データ:

```jsonc
// mcp:instance:{instanceId}
{ "startedAt": "2026-02-24T12:00:00.000Z" }

// mcp:session:{sessionId}
{
  "userId": "user-uuid",
  "instanceId": "instance-uuid",
  "createdAt": "2026-02-24T12:00:00.000Z"
}
```

既存キー（変更なし）:
```
mcp:token:oauth:{hash}               → OAuthトークンキャッシュ
mcp:token:apikey:{hash}              → APIキーキャッシュ
```

---

## テスト計画

### ユニットテスト

| テストファイル | テスト対象 |
|---------------|-----------|
| `__tests__/unit/lib/server-instance.test.ts` (新規) | インスタンスID生成、Redis登録/延長、生存確認、Redis未設定時のフォールバック |
| `__tests__/unit/lib/session-store.test.ts` (新規) | save/get/delete/refreshTtl、Redis未設定時のフォールバック |
| `__tests__/unit/transport/streamable-http.test.ts` (新規) | `resolveSessionError` の4パターン判定（session_not_found / server_restarted / wrong_instance / instance_terminated） |
| `__tests__/unit/services/heartbeat.service.test.ts` (既存に追加) | `refreshInstanceHeartbeat` がチェック時に呼ばれること |

### 統合テスト

| テストファイル | テスト対象 |
|---------------|-----------|
| `__tests__/integration/mcp-auth-session.integration.test.ts` (既存に追加) | 無効セッションIDのエラーレスポンスに `data.reinitialize: true` と `data.reason` が含まれること |

### 手動テスト

1. MCPセッション確立後にコード変更 → tsx watch再起動 → `server_restarted` エラーが返ること
2. 再度 `initialize` → 新しいセッションが正常確立されること
3. `/health` でインスタンスIDとアクティブセッション数が表示されること

---

## リスクと対策

| リスク | 影響 | 確率 | 対策 |
|--------|------|------|------|
| Redis未設定環境での動作 | Phase 1の一部機能が無効 | Medium | 全Redis操作にnullチェック。インメモリMapフォールバックで現行動作維持 |
| エラーレスポンス形式変更 | 既存クライアントへの影響 | Low | `error.data` はJSON-RPCオプショナルフィールド。既存の `code`/`message` は不変 |
| Redisメモリ肥大 | Redisメモリ枯渇 | Low | TTL 120-180秒で自動失効 + シャットダウン時に削除 |
| `isInstanceAlive` のRedis往復遅延 | エラーレスポンスの遅延 | Low | セッション不在時のみ発生（異常系）。正常系に影響なし |
| Cloud Runセッションアフィニティ不完全 | `wrong_instance` エラーの発生 | Medium | Redis層で検知し明確なエラーを返す。クライアントは再初期化で復旧可能 |

---

## 成功基準

- [ ] 再起動後の古いセッションに `data.reason: 'server_restarted'` が返る
- [ ] 別インスタンスへのリクエストに `data.reason: 'wrong_instance'` または `instance_terminated` が返る
- [ ] 全エラーレスポンスに `data.reinitialize: true` が含まれる
- [ ] 再 `initialize` で新セッションが正常確立される
- [ ] Redis未設定環境で現行動作を維持
- [ ] `/health` でインスタンスIDとアクティブセッション数を確認可能
- [ ] 新規ユニットテストが全てパス
- [ ] 既存テストが全てパス

---

## 実装順序

**Phase 1**: Step 1-1 → 1-2 → 1-3 → 1-4 → 1-5 → 1-6

**Phase 2**: Step 2-1 → 2-2 → 2-3 → 2-4

---

## 備考

- Claude Code側の自動再接続は現時点ではスコープ外。`data.reinitialize: true` フィールドは将来の自動再接続実装の足がかりとなる
- Cloud Run セッションアフィニティはベストエフォート。Redis層での検知が必須の補完となる
- 開発環境でのhot reload自体を抑制する方法（`tsx --watch --ignore` パターン）も別途検討に値する
