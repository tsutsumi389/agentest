# MCPセッション再起動耐性の改善

## 課題

GitHub Issue: #262

MCPサーバー（`apps/mcp-server`）のセッションがインメモリ `Map` に保持されているため、以下のシナリオでセッションが消滅し、クライアント（Claude Code）が `-32600` エラーで復旧できない。

- `tsx watch` によるホットリロード（開発中のコード変更の都度）
- Dockerコンテナの再起動
- サーバープロセスのクラッシュ

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

`StreamableHTTPServerTransport` インスタンスはシリアライズ不可（SDK制約）のため、サーバー再起動後のセッション復旧は不可能。クライアントに「再初期化が必要」と明確に伝え、サーバー側を適切にクリーンアップする仕組みを構築する。

---

## Phase 1: 短期対策（エラー改善 + 再起動検知）

### Step 1-1: サーバーインスタンスID管理の導入

**ファイル**: `apps/mcp-server/src/lib/server-instance.ts` (新規)

サーバープロセス起動ごとに一意のインスタンスIDを生成し、Redisに登録する。前回のインスタンスIDと比較することで再起動を検知する。

```typescript
import { randomUUID } from 'crypto';
import { getRedisClient } from './redis.js';

const SERVER_INSTANCE_ID = randomUUID();
const REDIS_KEY = 'mcp:server:instance-id';
const REDIS_PREVIOUS_KEY = 'mcp:server:previous-instance-id';

export function getServerInstanceId(): string {
  return SERVER_INSTANCE_ID;
}

export async function registerServerInstance(): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  const previousId = await redis.get(REDIS_KEY);
  if (previousId) {
    await redis.set(REDIS_PREVIOUS_KEY, previousId);
  }
  await redis.setex(REDIS_KEY, 3600, SERVER_INSTANCE_ID);
  return previousId;
}
```

**依存**: なし
**リスク**: Low（Redis未設定時はnullを返してフォールバック）

---

### Step 1-2: セッションメタデータのRedisストア

**ファイル**: `apps/mcp-server/src/lib/session-store.ts` (新規)

`McpSessionData` をRedisに永続化する。既存の `token-cache.ts` パターンに準拠。

```typescript
import { getRedisClient } from './redis.js';
import { getServerInstanceId } from './server-instance.js';
import type { McpSessionData } from '../transport/streamable-http.js';

const KEY_PREFIX = 'mcp:session:';
const INSTANCE_SESSIONS_KEY = 'mcp:instance-sessions:';
const SESSION_TTL_SECONDS = 180; // ハートビートタイムアウト(60s)の3倍
```

提供する関数:

| 関数 | 説明 |
|------|------|
| `saveSessionToRedis(sessionId, data)` | セッションメタデータ + サーバーインスタンスIDをRedisに保存 |
| `getSessionFromRedis(sessionId)` | セッションメタデータを取得 |
| `deleteSessionFromRedis(sessionId)` | セッションメタデータを削除 |
| `refreshSessionTtl(sessionId)` | セッションのTTLを延長 |
| `getInstanceSessionIds(instanceId)` | インスタンス別セッションID一覧を取得 |
| `deleteInstanceSessions(instanceId)` | インスタンスの全セッションを一括削除 |

**依存**: Step 1-1
**リスク**: Low（Redis未接続時は各関数が即returnし、インメモリMapで現行動作を維持）

---

### Step 1-3: エラーレスポンスの改善とRedis連携

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts` (変更)

#### 変更内容

1. **セッション作成時**: Redisへメタデータを保存
2. **セッション削除時**: Redisからもメタデータを削除
3. **無効セッションIDのリクエスト時**: Redisを参照して原因を区別

#### エラーレスポンスの改善

**変更前**（原因不明の一律エラー）:

```json
{
  "error": {
    "code": -32600,
    "message": "セッションが見つかりません。initializeリクエストから開始してください。"
  }
}
```

**変更後**（原因を区別、再初期化フラグ付き）:

サーバー再起動の場合:
```json
{
  "error": {
    "code": -32600,
    "message": "セッションが無効です。サーバーが再起動されたため、initializeリクエストから再開してください。",
    "data": { "reason": "server_restarted", "reinitialize": true }
  }
}
```

セッション不明の場合:
```json
{
  "error": {
    "code": -32600,
    "message": "セッションが見つかりません。initializeリクエストから開始してください。",
    "data": { "reason": "session_not_found", "reinitialize": true }
  }
}
```

#### 判定ロジック

```
リクエスト受信
  ├─ transports.has(sessionId) → 正常処理
  └─ transports.has(sessionId) === false
       ├─ Redis にメタデータあり → "server_restarted"（Redisからも削除）
       └─ Redis にもなし → "session_not_found"
```

**依存**: Step 1-2
**リスク**: Medium（`error.data` はJSON-RPCオプショナルフィールドなので既存パースを破壊しない）

---

### Step 1-4: サーバー起動時の孤立セッションクリーンアップ

**ファイル**: `apps/mcp-server/src/services/heartbeat.service.ts` (変更)

`HeartbeatService` に `cleanupOrphanedSessions(previousInstanceId)` メソッドを追加。

```typescript
async cleanupOrphanedSessions(previousInstanceId: string | null): Promise<void> {
  if (!previousInstanceId) return;

  // 1. 前回インスタンスのRedisセッション一覧を取得・削除
  const orphanedSessionIds = await getInstanceSessionIds(previousInstanceId);
  if (orphanedSessionIds.length > 0) {
    await deleteInstanceSessions(previousInstanceId);
  }

  // 2. DB上のタイムアウトセッションも処理
  await agentSessionService.processTimedOutSessions();
}
```

**依存**: Step 1-2
**リスク**: Low（既存の `processTimedOutSessions` を再利用）

---

### Step 1-5: サーバー起動シーケンスの更新

**ファイル**: `apps/mcp-server/src/index.ts` (変更)

`main()` 関数にインスタンスID登録と孤立セッションクリーンアップを追加。

```typescript
async function main() {
  await prisma.$connect();

  // サーバーインスタンスID登録（再起動検知）
  const previousInstanceId = await registerServerInstance();

  const app = createApp();

  // 前回インスタンスの孤立セッションをクリーンアップ
  await heartbeatService.cleanupOrphanedSessions(previousInstanceId);

  heartbeatService.start();
  // ... (以降は既存コード)
}
```

**依存**: Step 1-1, Step 1-4
**リスク**: Low

---

### Step 1-6: `deleteSession` / `cleanupAllSessions` のRedis連動

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts` (変更)

既存ユーティリティ関数でRedisからもデータを削除するよう修正。グレースフルシャットダウン時にRedisの孤立データを防ぐ。

**依存**: Step 1-2
**リスク**: Low

---

## Phase 2: 中期対策（監視強化 + 復旧高度化）

### Step 2-1: ヘルスチェックエンドポイントの拡張

**ファイル**: `apps/mcp-server/src/app.ts` (変更)

`/health` にサーバーインスタンスIDとアクティブセッション数を追加。

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

### Step 2-2: RedisセッションTTLのハートビート連動更新

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts` (変更)

既存セッションへのリクエスト処理時に `refreshSessionTtl()` を呼び出し、RedisのTTLをハートビートに連動して延長する。

**依存**: Step 1-2, Step 1-3
**リスク**: Low

---

### Step 2-3: 再初期化時のセッション引き継ぎログ

**ファイル**: `apps/mcp-server/src/transport/streamable-http.ts` (変更)

`initialize` リクエストで `mcp-session-id` ヘッダーが付いている場合（再初期化）、前回セッション情報をログに記録する。

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

### Step 2-4: HeartbeatServiceにインメモリ-DB整合性チェックを追加

**ファイル**: `apps/mcp-server/src/services/heartbeat.service.ts` (変更)

定期チェック時にインメモリセッション数をdebugログに出力し、運用監視を可能にする。

**依存**: Step 1-3
**リスク**: Low

---

## Redisキー設計

```
mcp:server:instance-id                → 現在のサーバーインスタンスID (STRING, TTL: 1h)
mcp:server:previous-instance-id       → 前回のサーバーインスタンスID (STRING, TTL: 1h)
mcp:session:{sessionId}               → セッションメタデータ JSON (STRING, TTL: 180s)
mcp:instance-sessions:{instanceId}    → セッションIDの集合 (SET, TTL: 180s)
```

既存キー（変更なし）:
```
mcp:token:oauth:{hash}                → OAuthトークンキャッシュ
mcp:token:apikey:{hash}               → APIキーキャッシュ
```

---

## テスト計画

### ユニットテスト

| テストファイル | テスト対象 |
|---------------|-----------|
| `__tests__/unit/lib/server-instance.test.ts` (新規) | インスタンスID生成、Redis登録、前回ID取得、Redis未設定時のフォールバック |
| `__tests__/unit/lib/session-store.test.ts` (新規) | save/get/delete/refresh/getInstanceIds/deleteInstance、Redis未設定時のフォールバック |
| `__tests__/unit/services/heartbeat.service.test.ts` (既存に追加) | `cleanupOrphanedSessions` のテスト |

### 統合テスト

| テストファイル | テスト対象 |
|---------------|-----------|
| `__tests__/integration/mcp-auth-session.integration.test.ts` (既存に追加) | 無効セッションIDのエラーレスポンスに `data.reinitialize: true` が含まれること |

### 手動テスト

1. MCPセッション確立後にコード変更 → tsx watch再起動 → `server_restarted` エラーが返ること
2. 再度 `initialize` リクエスト → 新しいセッションが正常確立されること
3. DB上のAgentSessionが起動時にクリーンアップされること

---

## リスクと対策

| リスク | 影響 | 確率 | 対策 |
|--------|------|------|------|
| Redis未設定環境での動作 | Phase 1の一部機能が無効 | Medium | 全Redis操作にnullチェック。インメモリMapフォールバックで現行動作維持 |
| エラーレスポンス形式変更 | 既存クライアントへの影響 | Low | `error.data` はJSON-RPCオプショナルフィールド。既存の `code`/`message` は不変 |
| Redisメモリ肥大 | Redisメモリ枯渇 | Low | TTL 180秒で自動失効 + シャットダウン時に削除 |
| 起動時クリーンアップのDB負荷 | 起動が遅くなる | Low | 既存の1回のクエリで処理 |

---

## 成功基準

- [ ] 再起動後の古いセッションに `data.reason: 'server_restarted'` が返る
- [ ] 再 `initialize` で新セッションが正常確立される
- [ ] DB孤立セッションが起動時に即座にクリーンアップされる
- [ ] Redis未設定環境で現行動作を維持
- [ ] `/health` でインスタンスIDとアクティブセッション数を確認可能
- [ ] 新規ユニットテストが全てパス
- [ ] 既存テストが全てパス

---

## 実装順序

**Phase 1**: Step 1-1 → 1-2 → 1-3 → 1-6 → 1-4 → 1-5

**Phase 2**: Step 2-1 → 2-2 → 2-3 → 2-4

---

## 備考

- Claude Code側の自動再接続は現時点ではスコープ外。`data.reinitialize: true` フィールドは将来の自動再接続実装の足がかりとなる
- 開発環境でのhot reload自体を抑制する方法（`tsx --watch --ignore` パターン）も別途検討に値する
