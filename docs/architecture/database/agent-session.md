# Agent セッション テーブル

## 概要

Coding Agent（Claude Code 等）のセッションを管理するテーブル。Agent による操作の追跡とセッション管理を行う。

## AgentSession

Agent セッションを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `projectId` | UUID | NO | - | プロジェクト ID（外部キー） |
| `clientId` | VARCHAR(255) | NO | - | MCP クライアント ID（例: claude-desktop-v1.2.3） |
| `clientName` | VARCHAR(100) | YES | NULL | クライアント表示名 |
| `status` | ENUM | NO | ACTIVE | セッションステータス |
| `startedAt` | TIMESTAMP | NO | now() | セッション開始日時 |
| `lastHeartbeat` | TIMESTAMP | NO | now() | 最終ハートビート日時 |
| `endedAt` | TIMESTAMP | YES | NULL | セッション終了日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### セッションステータス

| ステータス | 説明 |
|------------|------|
| `ACTIVE` | アクティブ（接続中） |
| `IDLE` | アイドル（一時的に非アクティブ） |
| `ENDED` | 終了（正常終了） |
| `TIMEOUT` | タイムアウト（ハートビート途絶） |

### Prisma スキーマ

```prisma
enum AgentSessionStatus {
  ACTIVE
  IDLE
  ENDED
  TIMEOUT
}

model AgentSession {
  id            String             @id @default(uuid()) @db.Uuid
  projectId     String             @db.Uuid
  clientId      String             @db.VarChar(255)
  clientName    String?            @db.VarChar(100)
  status        AgentSessionStatus @default(ACTIVE)
  startedAt     DateTime           @default(now())
  lastHeartbeat DateTime           @default(now())
  endedAt       DateTime?
  createdAt     DateTime           @default(now())

  project              Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdTestSuites    TestSuite[]
  createdTestCases     TestCase[]
  testSuiteHistories   TestSuiteHistory[]
  testCaseHistories    TestCaseHistory[]
  executions           Execution[]
  reviewComments       ReviewComment[]
  reviewCommentReplies ReviewCommentReply[]
  editLocks            EditLock[]
  uploadedEvidences    ExecutionEvidence[]

  @@index([projectId])
  @@index([status])
  @@index([lastHeartbeat])
}
```

---

## Agent 識別方法

### MCP リクエストヘッダー

```http
POST /mcp HTTP/1.1
Cookie: session=xxx
X-MCP-Client-Id: claude-desktop-v1.2.3
X-MCP-Session-Id: uuid-of-session
Content-Type: application/json
```

| ヘッダー | 説明 |
|----------|------|
| `X-MCP-Client-Id` | クライアント識別子（クライアントソフトウェア名+バージョン） |
| `X-MCP-Session-Id` | セッション ID（初回リクエスト後にサーバーから発行） |

### セッション開始フロー

```
1. Agent が MCP 接続開始
   └─▶ X-MCP-Client-Id ヘッダー付きでリクエスト

2. サーバーがセッション作成
   └─▶ AgentSession レコード作成
   └─▶ セッション ID をレスポンスヘッダーで返却

3. 以降のリクエスト
   └─▶ X-MCP-Session-Id ヘッダーでセッション ID を送信
   └─▶ サーバーが lastHeartbeat を更新
```

---

## セッション管理

### タイムアウト設定

| 項目 | 要件 |
|------|------|
| ハートビート間隔 | 30 秒 |
| セッションタイムアウト | 無操作 30 分で自動終了 |
| ハートビートタイムアウト | ハートビート途絶から 60 秒後に TIMEOUT |

### ハートビート処理

```
1. Agent からのリクエスト受信
   └─▶ lastHeartbeat = now()

2. 定期バッチ（1分間隔）
   └─▶ lastHeartbeat + 60秒 < now() のセッションを TIMEOUT に更新
   └─▶ TIMEOUT セッションのロックを解除
```

### セッション終了

```
正常終了:
  └─▶ Agent が明示的に終了リクエスト
  └─▶ status = ENDED, endedAt = now()
  └─▶ 関連するロックを解除

タイムアウト終了:
  └─▶ ハートビート途絶検知
  └─▶ status = TIMEOUT, endedAt = now()
  └─▶ 関連するロックを解除
```

---

## Agent 操作の記録

Agent による操作は、以下のテーブルで `AgentSession` への参照として記録される。

| テーブル | カラム | 説明 |
|----------|--------|------|
| `TestSuite` | `createdByAgentSessionId` | スイート作成者 |
| `TestCase` | `createdByAgentSessionId` | ケース作成者 |
| `TestSuiteHistory` | `changedByAgentSessionId` | スイート変更者 |
| `TestCaseHistory` | `changedByAgentSessionId` | ケース変更者 |
| `Execution` | `executedByAgentSessionId` | テスト実行者 |
| `ReviewComment` | `authorAgentSessionId` | コメント作成者 |
| `ReviewCommentReply` | `authorAgentSessionId` | 返信作成者 |
| `EditLock` | `lockedByAgentSessionId` | ロック取得者 |
| `ExecutionEvidence` | `uploadedByAgentSessionId` | エビデンス添付者 |

### 排他制約

各テーブルで `xxxByUserId` と `xxxByAgentSessionId` はどちらか一方のみ設定される排他制約を持つ。

```sql
ALTER TABLE "TestSuite" ADD CONSTRAINT "test_suite_creator_check"
  CHECK (
    (created_by_user_id IS NOT NULL AND created_by_agent_session_id IS NULL) OR
    (created_by_user_id IS NULL AND created_by_agent_session_id IS NOT NULL)
  );
```

---

## Coding Agent 向け ENUM 値について

ENUM 値は意味のある英語の文字列を使用しており、Coding Agent が理解しやすい設計となっている。

### 例

| ENUM | 値 | Coding Agent の解釈 |
|------|-----|---------------------|
| `TestSuiteStatus` | `DRAFT`, `ACTIVE`, `ARCHIVED` | 下書き、有効、アーカイブ済み |
| `TestCasePriority` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` | 優先度を直感的に理解 |
| `PreconditionStatus` | `UNCHECKED`, `MET`, `NOT_MET` | 未確認、満たしている、満たしていない |
| `JudgmentStatus` | `PENDING`, `PASS`, `FAIL`, `SKIPPED` | 未判定、成功、失敗、スキップ |

MCP ツールでもこれらの値をそのまま使用するため、Agent は自然言語的に解釈可能。

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| AG-009 | MCP サーバー連携 | Streamable HTTP で MCP サーバーと連携 |
| AG-010 | Agent 識別 | MCP リクエストヘッダーで Agent 操作を識別・記録 |
| AG-011 | Agent セッション管理 | Agent のハートビート監視と自動セッション終了 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [同時編集制御](./edit-lock.md)
- [テスト実行](./execution.md)
