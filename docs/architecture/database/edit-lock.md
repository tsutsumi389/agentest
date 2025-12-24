# 同時編集制御 テーブル

## 概要

テストスイート・テストケースの同時編集を制御するテーブル。人と人、Agent と人の同時編集を防止。

## EditLock

編集ロックを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `targetType` | ENUM | NO | - | 対象種別（SUITE, CASE） |
| `targetId` | UUID | NO | - | 対象 ID（テストスイート or テストケース） |
| `lockedByUserId` | UUID | YES | NULL | ロック取得者ユーザー ID（外部キー）※1 |
| `lockedByAgentSessionId` | UUID | YES | NULL | ロック取得者 Agent セッション ID（外部キー）※1 |
| `lockedAt` | TIMESTAMP | NO | now() | ロック取得日時 |
| `lastHeartbeat` | TIMESTAMP | NO | now() | 最終ハートビート日時 |
| `expiresAt` | TIMESTAMP | NO | - | ロック有効期限 |

※1: `lockedByUserId` と `lockedByAgentSessionId` はどちらか一方のみ設定（排他制約）

### 対象種別

| 種別 | 説明 |
|------|------|
| `SUITE` | テストスイート |
| `CASE` | テストケース |

### Prisma スキーマ

```prisma
enum LockTargetType {
  SUITE
  CASE
}

model EditLock {
  id                     String         @id @default(uuid()) @db.Uuid
  targetType             LockTargetType
  targetId               String         @db.Uuid
  lockedByUserId         String?        @db.Uuid
  lockedByAgentSessionId String?        @db.Uuid
  lockedAt               DateTime       @default(now())
  lastHeartbeat          DateTime       @default(now())
  expiresAt              DateTime

  lockedByUser         User?         @relation(fields: [lockedByUserId], references: [id], onDelete: Cascade)
  lockedByAgentSession AgentSession? @relation(fields: [lockedByAgentSessionId], references: [id], onDelete: Cascade)

  @@unique([targetType, targetId])
  @@index([targetType, targetId])
  @@index([expiresAt])
}
```

---

## ロック構造

```
EditLock
├── id
├── targetType (SUITE / CASE)
├── targetId
├── lockedByUserId (人の場合)
├── lockedByAgentSessionId (Agent の場合)
├── lockedAt
├── lastHeartbeat
└── expiresAt
```

---

## ハートビートとタイムアウト

### タイムアウト設定

| 項目 | 要件 |
|------|------|
| ハートビート間隔 | 30 秒 |
| ロック有効期限 | ハートビート途絶から 60 秒後に自動解除 |
| セッションタイムアウト | 無操作 30 分で自動終了 |

### ハートビート処理

```
1. ロック取得時
   └─▶ expiresAt = now() + 90秒

2. ハートビート受信時（30秒間隔）
   └─▶ lastHeartbeat = now()
   └─▶ expiresAt = now() + 90秒

3. 有効期限チェック（定期バッチ）
   └─▶ expiresAt < now() のロックを削除
```

---

## ロック取得フロー

```
1. ロック取得リクエスト
   │
   ├─▶ 既存ロックなし
   │   └─▶ ロック作成、成功レスポンス
   │
   └─▶ 既存ロックあり
       │
       ├─▶ 自分のロック
       │   └─▶ lastHeartbeat 更新、成功レスポンス
       │
       ├─▶ 有効期限切れ
       │   └─▶ 既存ロック削除、新規ロック作成
       │
       └─▶ 他者のロック（有効）
           └─▶ 失敗レスポンス（ロック保持者情報を返却）
```

---

## Agent のセッション管理

### MCP 接続管理

```
1. Agent が MCP 接続開始
   └─▶ セッション開始、ハートビート送信開始

2. 編集開始時
   └─▶ ロック取得リクエスト

3. 編集中（30秒間隔）
   └─▶ ハートビート送信
   └─▶ lastHeartbeat, expiresAt 更新

4. 編集完了
   └─▶ ロック解放リクエスト

5. 接続切断（異常終了）
   └─▶ ハートビート途絶
   └─▶ 60秒後にロック自動解除
```

### Agent 識別

```http
POST /mcp HTTP/1.1
Cookie: session=xxx
X-MCP-Client-Id: claude-desktop-v1.2.3
X-MCP-Session-Id: agent-session-uuid
Content-Type: application/json
```

- `X-MCP-Client-Id` ヘッダーで Agent を識別
- `X-MCP-Session-Id` ヘッダーでセッションを識別
- ロックの `lockedByAgentSessionId` に Agent セッション ID を設定

---

## 強制ロック解除

### 条件

- 管理者権限を持つユーザーのみ実行可能
- ロック保持者（Agent/人）に通知

### 処理フロー

```
1. 管理者がロック解除リクエスト
2. ロック削除
3. ロック保持者に通知
   ├─▶ 人の場合: WebSocket で通知
   └─▶ Agent の場合: MCP レスポンスで通知
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| CE-001 | 編集ロック | テストスイート・テストケース編集時に他ユーザーをブロック |
| CE-002 | 編集中表示 | 編集中のユーザー名を他ユーザーに表示 |
| CE-003 | 人-人同時編集 | 人と人の同時編集を制御 |
| CE-004 | Agent-人同時編集 | Coding Agent と人の同時編集を制御 |
| CE-005 | MCP 切断時ロック解除 | MCP 接続切断検知時に自動でロック解除 |
| CE-006 | 管理者強制ロック解除 | 管理者が強制的にロックを解除 |
| AG-011 | Agent セッション管理 | Agent のハートビート監視と自動セッション終了 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [テストスイート](./test-suite.md)
- [テストケース](./test-case.md)
- [Agent セッション](./agent-session.md)
