# 同時編集制御 テーブル

## 概要

テストスイート・テストケースの同時編集を制御するテーブル。人と人、Agent と人の同時編集を防止。

### 設計方針: 人間 vs Agent

| 観点 | 人間ユーザー | Agent（MCP） |
|------|------------|----------------|
| 操作パターン | 編集画面を開く → 編集 → 保存 | ツール1回で更新完了 |
| ロック方式 | **悲観的ロック**: 編集開始時にロック取得 | **楽観的ロック**: ロック確認のみ |
| ロック期間 | 長時間（数分〜）、ハートビートで延長 | ロック取得しない |
| 競合時 | 409 Conflict + 編集不可 | 409 Conflict + 更新拒否 |

> **Note**: Agent は楽観的ロック方式のため、`lockedByAgentSessionId` フィールドは現在使用していません。将来的にスキーマから削除を検討。

---

## EditLock

編集ロックを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `targetType` | ENUM | NO | - | 対象種別（SUITE, CASE） |
| `targetId` | UUID | NO | - | 対象 ID（テストスイート or テストケース） |
| `lockedByUserId` | UUID | YES | NULL | ロック取得者ユーザー ID（外部キー） |
| `lockedByAgentSessionId` | UUID | YES | NULL | ※現在未使用（将来削除予定） |
| `lockedAt` | TIMESTAMP | NO | now() | ロック取得日時 |
| `lastHeartbeat` | TIMESTAMP | NO | now() | 最終ハートビート日時 |
| `expiresAt` | TIMESTAMP | NO | - | ロック有効期限 |

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
  lockedByAgentSessionId String?        @db.Uuid  // 現在未使用
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
├── lockedByUserId (人間ユーザーのみ使用)
├── lockedByAgentSessionId (未使用)
├── lockedAt
├── lastHeartbeat
└── expiresAt
```

---

## 人間ユーザーのロック（悲観的ロック）

### タイムアウト設定

| 項目 | 値 |
|------|------|
| ロック有効期限 | 90 秒 |
| ハートビート間隔 | 30 秒（推奨） |
| ハートビート途絶タイムアウト | 60 秒 |

### ハートビート処理

```
1. ロック取得時
   └─▶ expiresAt = now() + 90秒

2. ハートビート受信時（30秒間隔）
   └─▶ lastHeartbeat = now()
   └─▶ expiresAt = now() + 90秒

3. 有効期限チェック（定期バッチ: 30秒間隔）
   └─▶ expiresAt < now() のロックを削除
```

### ロック取得フロー

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
           └─▶ 409 Conflict（ロック保持者情報を返却）
```

---

## Agent のロック（楽観的ロック）

Agent（MCP 経由）は悲観的ロックを取得せず、更新直前にロック状態を確認する楽観的ロック方式を採用。

### 更新フロー

```
1. Agent が更新リクエスト（update_test_suite 等）
   │
   ├─▶ ロック状態を確認（GET /api/locks）
   │
   ├─▶ ロックなし
   │   └─▶ 更新実行、成功レスポンス
   │
   └─▶ 人間がロック中
       └─▶ 409 Conflict（更新拒否）
           「ユーザー '{name}' が現在このテストスイートを編集中です」
```

### 設計理由

- Agent は1回のツール呼び出しで更新が完了するため、長時間ロックを保持する必要がない
- ロック管理のオーバーヘッド（ハートビート送信等）を回避
- 人間の編集を優先し、Agent は人間のロックを尊重する

---

## 強制ロック解除

### 条件

- プロジェクトまたは組織の OWNER/ADMIN 権限を持つユーザーのみ実行可能
- ロック保持者（人間）に WebSocket で通知

### 処理フロー

```
1. 管理者がロック解除リクエスト（DELETE /api/locks/:lockId/force）
2. ADMIN 権限チェック
3. ロック削除
4. ロック保持者に WebSocket 通知（lock:expired イベント）
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| CE-001 | 編集ロック | テストスイート・テストケース編集時に他ユーザーをブロック |
| CE-002 | 編集中表示 | 編集中のユーザー名を他ユーザーに表示 |
| CE-003 | 人-人同時編集 | 先着順ロック、有効期限 90 秒 |
| CE-004 | Agent-人同時編集 | Agent は楽観的ロックで人間のロックを尊重 |
| CE-005 | 自動ロック解除 | ハートビート途絶 60 秒で自動解除（人間のみ） |
| CE-006 | 管理者強制ロック解除 | 管理者が強制的にロックを解除 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [テストスイート](./test-suite.md)
- [テストケース](./test-case.md)
- [編集ロック API](../../api/edit-locks.md)
