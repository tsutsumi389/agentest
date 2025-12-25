# 使用量記録 テーブル

## 概要

MCP セッション使用量を記録するテーブル。月次でリセットされ、プラン別の制限管理に使用。

## UsageRecord

月次使用量を記録するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | YES | NULL | ユーザー ID（外部キー）※1 |
| `organizationId` | UUID | YES | NULL | 組織 ID（外部キー）※1 |
| `periodStart` | DATE | NO | - | 集計期間開始日（月初） |
| `periodEnd` | DATE | NO | - | 集計期間終了日（月末） |
| `mcpSessions` | INTEGER | NO | 0 | MCP セッション数 |
| `mcpSessionLimit` | INTEGER | NO | - | MCP セッション上限 |
| `alertSentAt` | TIMESTAMP | YES | NULL | 使用量アラート送信日時（80%到達時） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

※1: `userId` と `organizationId` はどちらか一方のみ設定（排他制約）

### プラン別 MCP セッション制限

| プラン | MCP セッション/月 | MCP 同時接続数 |
|--------|-------------------|----------------|
| Free | 100 | 1 |
| Pro | 1,000 | 3 |
| Team | 5,000 × ユーザー数（組織プール） | 5 × ユーザー数（組織プール） |
| Enterprise | 無制限 | 無制限 |

### MCP セッションのカウント方法

- エージェントの一連の操作を1セッションとしてカウント
- 例：テストケース作成依頼 → テストスイート作成 → テストケース作成の繰り返し → エージェント終了 = 1セッション
- 個々のツール呼び出しではなく、エージェントが停止するまでの一連の流れで1回

### 制約

- `userId` + `periodStart` は一意（個人の場合）
- `organizationId` + `periodStart` は一意（組織の場合）
- `userId` か `organizationId` のどちらか一方が必ず設定される（排他制約）

### Prisma スキーマ

```prisma
model UsageRecord {
  id              String    @id @default(uuid()) @db.Uuid
  userId          String?   @db.Uuid
  organizationId  String?   @db.Uuid
  periodStart     DateTime  @db.Date
  periodEnd       DateTime  @db.Date
  mcpSessions     Int       @default(0)
  mcpSessionLimit Int
  alertSentAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, periodStart])
  @@unique([organizationId, periodStart])
  @@index([userId])
  @@index([organizationId])
  @@index([periodStart])
}
```

### 排他制約（SQL）

```sql
-- userId か organizationId のどちらか一方のみ設定
ALTER TABLE "UsageRecord" ADD CONSTRAINT "usage_record_owner_check"
  CHECK (
    (user_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND organization_id IS NOT NULL)
  );
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| BIL-008 | 使用量表示 | 現在の MCP セッション使用量を表示 |
| BIL-009 | 使用量アラート | MCP セッションが月間制限の 80% に達した際のメール通知 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [課金・サブスクリプション](./billing.md)
- [Agent セッション](./agent-session.md)
