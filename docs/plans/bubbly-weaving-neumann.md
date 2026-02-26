# MCPセッション確認機能の追加

## Context

MCPサーバー（`apps/mcp-server`）ではAgentSession（MCPセッション）の管理機能が既に実装されているが、ユーザーがWeb UIからセッションの状態を確認・管理する手段がない。ユーザー設定画面（`/settings`）に「MCPセッション」タブを追加し、所属プロジェクトのMCPセッションを横断的に確認・終了できる機能を実装する。

## 変更ファイル一覧

### バックエンド（新規: 4ファイル）
| ファイル | 概要 |
|---|---|
| `apps/api/src/repositories/agent-session.repository.ts` | Prismaクエリ層 |
| `apps/api/src/services/agent-session.service.ts` | ビジネスロジック |
| `apps/api/src/controllers/agent-session.controller.ts` | リクエスト処理 |
| `apps/api/src/routes/agent-sessions.ts` | ルート定義 |

### 既存変更（3ファイル）
| ファイル | 概要 |
|---|---|
| `apps/api/src/routes/index.ts` | ルート登録追加 |
| `apps/web/src/lib/api.ts` | APIクライアント追加 |
| `apps/web/src/pages/Settings.tsx` | タブ・コンポーネント追加 |

---

## API設計

### GET /api/agent-sessions
ユーザーが所属するプロジェクトのAgentSession一覧を取得。

**クエリパラメータ**:
- `status` (string, default: `ACTIVE,IDLE`): カンマ区切りでフィルタ
- `page` (number, default: 1)
- `limit` (number, default: 50, max: 100)

**レスポンス**:
```json
{
  "data": [{
    "id": "uuid",
    "projectId": "uuid",
    "projectName": "プロジェクト名",
    "clientId": "claude-code-xxx",
    "clientName": "Claude Code",
    "status": "ACTIVE",
    "startedAt": "ISO8601",
    "lastHeartbeat": "ISO8601",
    "endedAt": null
  }],
  "meta": { "total": 10, "page": 1, "limit": 50 }
}
```

### DELETE /api/agent-sessions/:sessionId
セッションを終了（ENDED）に更新。ユーザーがプロジェクトメンバーであることを検証。

---

## 実装ステップ

### Step 1: Repository（`apps/api/src/repositories/agent-session.repository.ts`）

```typescript
export class AgentSessionRepository {
  // ユーザー所属プロジェクトのセッション取得（ProjectMember経由）
  async findByUserProjects(params: { userId, statuses, page, limit })
  // ID指定取得（プロジェクト情報include）
  async findById(id: string)
  // セッション終了
  async endSession(id: string)
}
```

- `findByUserProjects`: ProjectMemberからプロジェクトID一覧取得 → AgentSession検索（`include: { project: { select: { id, name } } }`）
- 既存参考: `apps/api/src/repositories/session.repository.ts`（クラスベース）

### Step 2: Service（`apps/api/src/services/agent-session.service.ts`）

```typescript
export class AgentSessionService {
  parseStatuses(statusParam?: string): AgentSessionStatus[]
  async getSessionsByUser(params): Promise<{ sessions: AgentSessionInfo[], total }>
  async endSession(userId, sessionId): Promise<{ success: boolean }>
}
```

- `endSession`: セッション存在確認 → ProjectMemberチェック → 終了済み検証 → ステータス更新
- エラー: `NotFoundError`, `AuthorizationError`, `ValidationError`（`@agentest/shared`）
- ロガー: `logger.child({ module: 'agent-session' })`

### Step 3: Controller（`apps/api/src/controllers/agent-session.controller.ts`）

- `getSessions`: クエリパラメータ解析、service呼び出し、`res.json({ data, meta })`
- `endSession`: `req.params.sessionId` → service呼び出し、`res.json({ data: { success } })`
- 既存参考: `apps/api/src/controllers/session.controller.ts`

### Step 4: Routes

**`apps/api/src/routes/agent-sessions.ts`**（新規）:
```
GET  /  → controller.getSessions
DELETE /:sessionId → controller.endSession
```
- `requireAuth(authConfig)` で認証必須

**`apps/api/src/routes/index.ts`**（変更）:
- import追加 + `router.use('/api/agent-sessions', agentSessionRoutes)` を52行目付近に追加

### Step 5: フロントエンド APIクライアント（`apps/web/src/lib/api.ts`）

```typescript
export type AgentSessionStatus = 'ACTIVE' | 'IDLE' | 'ENDED' | 'TIMEOUT';

export interface AgentSessionItem {
  id: string; projectId: string; projectName: string;
  clientId: string; clientName: string | null;
  status: AgentSessionStatus; startedAt: string;
  lastHeartbeat: string; endedAt: string | null;
}

export const agentSessionsApi = {
  list: (params?) => api.get(...)
  end: (sessionId) => api.delete(...)
}
```

### Step 6: Settings.tsx 変更

**6.1 型・import追加**:
- `SettingsTab` に `'mcp-sessions'` 追加
- lucide-react から `Bot` アイコンimport
- `agentSessionsApi`, `AgentSessionItem`, `AgentSessionStatus` をimport
- `formatRelativeTime` を `../lib/date` からimport（既存ユーティリティ再利用）

**6.2 tabs配列に追加**:
```typescript
{ id: 'mcp-sessions' as const, label: 'MCPセッション', icon: Bot }
```

**6.3 コンテンツ切り替え追加**:
```typescript
{activeTab === 'mcp-sessions' && <McpSessionSettings />}
```

**6.4 `McpSessionSettings` コンポーネント**:
- 表示上限: `INITIAL_MCP_SESSION_DISPLAY_COUNT = 10`
- ステート: `sessions`, `isLoading`, `showAllSessions`, `endingSessionId`, `confirmDialog`, `includeEnded`
- フェッチ: `useState + useCallback + useEffect`（既存パターン踏襲）
- 終了済みセッション表示トグル（checkbox）
- セッション終了: 確認ダイアログ（`ConfirmDialog` 再利用）→ `agentSessionsApi.end()` → 楽観的更新

**6.5 ステータスバッジ**:
| ステータス | バッジクラス | ラベル |
|---|---|---|
| ACTIVE | `badge badge-success` | アクティブ |
| IDLE | `badge badge-warning` | アイドル |
| ENDED | `badge text-foreground-muted bg-background-tertiary` | 終了 |
| TIMEOUT | `badge badge-danger` | タイムアウト |

**6.6 セッション行の表示項目**:
- クライアント名（`clientName || clientId`）+ Botアイコン
- プロジェクト名
- ステータスバッジ
- 開始時刻（`formatRelativeTime`）
- 最終ハートビート（`formatRelativeTime`）
- 終了ボタン（ACTIVE/IDLEのみ表示）

---

## 再利用する既存コード

| 対象 | ファイルパス |
|---|---|
| `formatRelativeTime` | `apps/web/src/lib/date.ts:77` |
| `ConfirmDialog` | `apps/web/src/pages/Settings.tsx:512` |
| バッジCSS | `apps/web/src/styles/globals.css:184-207` |
| Repository クラスパターン | `apps/api/src/repositories/session.repository.ts` |
| Controller パターン | `apps/api/src/controllers/session.controller.ts` |
| エラークラス | `packages/shared/src/errors/index.ts` |
| Logger パターン | `apps/api/src/utils/logger.ts` |

---

## 検証方法

1. Docker環境起動: `cd docker && docker compose up`
2. ビルド確認: `docker compose exec dev pnpm build`
3. API動作確認:
   - `GET /api/agent-sessions` → 所属プロジェクトのセッション一覧が返る
   - `GET /api/agent-sessions?status=ACTIVE,IDLE,ENDED,TIMEOUT` → 全ステータス
   - `DELETE /api/agent-sessions/:id` → セッション終了
   - 非メンバーのプロジェクトセッション終了 → 403
4. フロントエンド確認:
   - `/settings?tab=mcp-sessions` でタブ表示
   - セッション一覧のローディング/空/リスト表示
   - ステータスバッジの色分け
   - 終了ボタン → 確認ダイアログ → 終了処理
   - 表示上限（10件超で展開ボタン）
   - 終了済み表示トグル
5. リント: `docker compose exec dev pnpm lint`
