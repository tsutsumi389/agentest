# Phase 9: 同時編集制御 - 詳細実装計画

## 概要

テストスイート・テストケースを複数ユーザー・Coding Agentが同時に編集する環境で、安全な排他制御を実現する。

### 対象要件
| ID | 機能 | 説明 |
|----|------|------|
| CE-001 | 編集ロック基盤 | テストスイート/ケース編集時に他ユーザーをブロック |
| CE-002 | 編集中表示 | 編集中のユーザー名をリアルタイム表示 |
| CE-003 | 人-人同時編集 | 先着順ロック、有効期限90秒 |
| CE-004 | Agent-人同時編集 | **楽観的ロック**: Agentは人間のロックを尊重し、ロック中は更新拒否 |
| CE-005 | 自動ロック解除 | ハートビート途絶60秒で自動解除（人間ユーザーのみ） |
| CE-006 | 強制ロック解除 | 管理者による強制解除 |

### 設計方針: 人間 vs Agent

| 観点 | 人間ユーザー | Agent（MCP） |
|------|------------|-------------|
| 操作パターン | 編集画面を開く → 編集 → 保存 | ツール1回で更新完了 |
| ロック方式 | **悲観的ロック**: 編集開始時にロック取得 | **楽観的ロック**: ロック確認のみ |
| ロック期間 | 長時間（数分〜）、ハートビートで延長 | ロック取得しない |
| 競合時 | 409 Conflict + 編集不可 | 409 Conflict + 更新拒否 |

### 既存実装状況
- **EditLockモデル**: `packages/db/prisma/schema.prisma` に定義済み（API未実装）
- **WebSocket基盤**: `apps/ws/` で完全実装済み（Redis Pub/Sub、Presence）
- **イベント型**: `packages/ws-types` で lock:acquired/released/expired 定義済み

> **Note**: EditLockモデルの `lockedByAgentSessionId` フィールドは、Agentが楽観的ロック方式のため使用しない。将来的にスキーマから削除を検討。

---

## 実装ステップ

### Step 1: バックエンド基盤

#### 1.1 EditLockRepository
**ファイル**: `apps/api/src/repositories/edit-lock.repository.ts`（新規）

```typescript
export class EditLockRepository {
  findByTarget(targetType: LockTargetType, targetId: string): Promise<EditLock | null>
  findById(id: string): Promise<EditLock | null>
  create(data: CreateEditLockData): Promise<EditLock>
  updateHeartbeat(id: string, expiresAt: Date): Promise<EditLock>
  delete(id: string): Promise<void>
  findExpired(): Promise<EditLock[]>
}
```

#### 1.2 EditLockService
**ファイル**: `apps/api/src/services/edit-lock.service.ts`（新規）

```typescript
// タイムアウト設定
export const LOCK_CONFIG = {
  LOCK_DURATION_SECONDS: 90,        // ロック有効期限
  HEARTBEAT_INTERVAL_SECONDS: 30,   // ハートビート推奨間隔
  HEARTBEAT_TIMEOUT_SECONDS: 60,    // 途絶タイムアウト
};

export class EditLockService {
  acquireLock(targetType, targetId, actorInfo): Promise<EditLock>
  releaseLock(lockId, actorInfo): Promise<void>
  updateHeartbeat(lockId, actorInfo): Promise<EditLock>
  forceRelease(lockId): Promise<void>
  processExpiredLocks(): Promise<number>
}
```

#### 1.3 カスタムエラー
**ファイル**: `apps/api/src/errors/lock-conflict.error.ts`（新規）

```typescript
export class LockConflictError extends AppError {
  constructor(existingLock: EditLock) {
    super('CONFLICT', 'Resource is already locked', 409);
    this.lockedBy = { type, id, name };
    this.expiresAt = existingLock.expiresAt;
  }
}
```

---

### Step 2: API エンドポイント

**ファイル**: `apps/api/src/routes/edit-locks.ts`（新規）

| メソッド | エンドポイント | 説明 | 権限 |
|---------|--------------|------|------|
| POST | `/api/locks` | ロック取得 | 認証必須 |
| GET | `/api/locks` | ロック状態確認 | 認証必須 |
| PATCH | `/api/locks/:lockId/heartbeat` | ハートビート更新 | 認証必須 |
| DELETE | `/api/locks/:lockId` | ロック解放 | ロック所有者 |
| DELETE | `/api/locks/:lockId/force` | 強制解除 | 管理者 |

#### レスポンス例

**201 Created（ロック取得成功）**:
```json
{
  "lock": {
    "id": "uuid",
    "targetType": "SUITE",
    "targetId": "uuid",
    "lockedBy": { "type": "user", "id": "uuid", "name": "Alice" },
    "expiresAt": "2024-01-10T12:01:30Z"
  }
}
```

**409 Conflict（ロック競合）**:
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Resource is already locked",
    "lockedBy": { "type": "user", "id": "uuid", "name": "Bob" },
    "expiresAt": "2024-01-10T12:01:30Z"
  }
}
```

---

### Step 3: WebSocket連携

**ファイル**: `apps/ws/src/handlers/lock.ts`（新規）

```typescript
// Redis Pub/Sub経由でイベント配信
export async function publishLockAcquired(lock: EditLock, projectId: string): Promise<void>
export async function publishLockReleased(lock: EditLock, projectId: string): Promise<void>
export async function publishLockExpired(lock: EditLock, projectId: string): Promise<void>
```

**配信チャンネル**:
- `test_suite:{testSuiteId}` - スイート/ケースを閲覧中のユーザー
- `project:{projectId}` - プロジェクト全体

---

### Step 4: 定期バッチ処理

**ファイル**: `apps/api/src/jobs/lock-cleanup.job.ts`（新規）

```typescript
// 30秒間隔で実行
export function startLockCleanupJob(intervalMs = 30000): void {
  setInterval(async () => {
    const count = await editLockService.processExpiredLocks();
    if (count > 0) console.log(`${count}件の期限切れロックを解除`);
  }, intervalMs);
}
```

---

### Step 5: フロントエンド

#### 5.1 useEditLock Hook
**ファイル**: `apps/web/src/hooks/useEditLock.ts`（新規）

```typescript
interface UseEditLockResult {
  isLocked: boolean;
  isOwnLock: boolean;
  lockHolder: { type: 'user' | 'agent'; name: string } | null;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
}

export function useEditLock(options: { targetType, targetId }): UseEditLockResult {
  // ロック取得/解放
  // 30秒間隔のハートビート送信
  // WebSocketイベント購読（lock:acquired/released/expired）
  // クリーンアップ（コンポーネントアンマウント時にロック解放）
}
```

#### 5.2 LockIndicator コンポーネント
**ファイル**: `apps/web/src/components/edit-lock/LockIndicator.tsx`（新規）

```tsx
// 自分がロック中: 緑色「編集中」表示
// 他者がロック中: 黄色「{name}が編集中」表示
```

#### 5.3 既存画面への統合
- `TestSuiteEdit.tsx` - 編集開始時にロック取得、保存/キャンセル時に解放
- `TestCaseEdit.tsx` - 同上

---

### Step 6: MCP連携（楽観的ロック）

#### 6.1 MCPツールでのロック確認
**更新対象**:
- `apps/mcp-server/src/tools/update-test-suite.ts`
- `apps/mcp-server/src/tools/update-test-case.ts`
- `apps/mcp-server/src/tools/delete-test-suite.ts`
- `apps/mcp-server/src/tools/delete-test-case.ts`

```typescript
// 更新処理の前にロック確認（取得はしない）
const lockStatus = await apiClient.get('/internal/api/locks', {
  targetType: 'SUITE',
  targetId
});

if (lockStatus.lock) {
  // 人間がロック中 → 更新拒否
  throw new LockConflictError(lockStatus.lock);
}

// ロックなし → そのまま更新実行
await updateOperation();
```

#### 6.2 エラーレスポンス（MCP向け）
Agentがロック競合時に受け取るエラー：

```json
{
  "isError": true,
  "content": [{
    "type": "text",
    "text": "編集がブロックされました。ユーザー 'Alice' が現在このテストスイートを編集中です。しばらく待ってから再試行してください。"
  }]
}
```

> **Note**: Agentはロックを取得しないため、ハートビート管理やセッション連携は不要。

---

### Step 7: テスト

#### 7.1 ユニットテスト
- `apps/api/src/__tests__/unit/edit-lock.repository.test.ts`
- `apps/api/src/__tests__/unit/edit-lock.service.test.ts`
- `apps/api/src/__tests__/unit/edit-lock.controller.test.ts`

#### 7.2 結合テスト
**ファイル**: `apps/api/src/__tests__/integration/edit-lock.integration.test.ts`

テストケース:
1. 先着順でロックが取得される（人間-人間）
2. ロック競合時に409 Conflictが返る
3. ハートビート途絶90秒で自動解除
4. **Agentが人間のロックを尊重**（楽観的ロック）
   - 人間がロック中 → Agent更新拒否
   - 人間がロックなし → Agent更新成功
5. 管理者による強制解除
6. WebSocket通知が正しく配信される

---

## ファイル構成

```
apps/api/src/
├── controllers/
│   └── edit-lock.controller.ts      # 新規
├── services/
│   └── edit-lock.service.ts         # 新規
├── repositories/
│   └── edit-lock.repository.ts      # 新規
├── routes/
│   └── edit-locks.ts                # 新規
├── errors/
│   └── lock-conflict.error.ts       # 新規
├── jobs/
│   └── lock-cleanup.job.ts          # 新規
└── __tests__/
    ├── unit/
    │   └── edit-lock.*.test.ts      # 新規
    └── integration/
        └── edit-lock.integration.test.ts  # 新規

apps/ws/src/
└── handlers/
    └── lock.ts                      # 新規

apps/web/src/
├── hooks/
│   └── useEditLock.ts               # 新規
└── components/
    └── edit-lock/
        ├── LockIndicator.tsx        # 新規
        └── LockConflictModal.tsx    # 新規

apps/mcp-server/src/
└── tools/
    ├── update-test-suite.ts         # 更新（ロック確認追加）
    ├── update-test-case.ts          # 更新（ロック確認追加）
    ├── delete-test-suite.ts         # 更新（ロック確認追加）
    └── delete-test-case.ts          # 更新（ロック確認追加）
```

---

## 重要な参照ファイル

| ファイル | 目的 |
|---------|------|
| `packages/db/prisma/schema.prisma` | EditLockモデル定義（839-855行目） |
| `packages/ws-types/src/events.ts` | LockEvent型定義（158-185行目） |
| `apps/ws/src/handlers/execution.ts` | WebSocket通知パターン参考 |
| `apps/api/src/services/test-suite.service.ts` | Serviceパターン参考 |
| `apps/web/src/lib/ws.ts` | WebSocketクライアント |

---

## 検証方法

### 動作確認手順（人間-人間）
1. Docker環境起動: `cd docker && docker compose up`
2. テストスイート編集画面を2つのブラウザで開く
3. 一方で編集開始 → ロック取得確認
4. 他方で「{name}が編集中」表示確認
5. 90秒放置 → ロック自動解除確認
6. 管理者権限で強制解除テスト

### 動作確認手順（Agent-人間）
1. ブラウザでテストスイート編集画面を開き、編集開始（ロック取得）
2. MCPツールでupdate_test_suiteを実行
3. 「編集がブロックされました」エラー確認
4. ブラウザで編集を保存/キャンセル（ロック解放）
5. MCPツールで再度update_test_suiteを実行 → 成功

### テスト実行
```bash
docker compose exec dev pnpm test -- --filter @agentest/api edit-lock
```
