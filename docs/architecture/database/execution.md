# テスト実行 テーブル

## 概要

テスト実行とその結果を管理するテーブル群。実行開始時にスナップショットを作成し、実行中にテストケースが編集されても結果に影響しない設計。

## Execution

テスト実行を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testSuiteId` | UUID | NO | - | テストスイート ID（外部キー） |
| `executedByUserId` | UUID | YES | NULL | 実行者ユーザー ID（外部キー）※1 |
| `executedByAgentSessionId` | UUID | YES | NULL | 実行者 Agent セッション ID（外部キー）※1 |
| `status` | ENUM | NO | IN_PROGRESS | 実行ステータス |
| `startedAt` | TIMESTAMP | NO | now() | 開始日時 |
| `completedAt` | TIMESTAMP | YES | NULL | 完了日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

※1: `executedByUserId` と `executedByAgentSessionId` はどちらか一方のみ設定（排他制約）

### 実行ステータス

| ステータス | 説明 |
|------------|------|
| `IN_PROGRESS` | 実行中 |
| `COMPLETED` | 完了 |
| `ABORTED` | 中断 |

### Prisma スキーマ

```prisma
enum ExecutionStatus {
  IN_PROGRESS
  COMPLETED
  ABORTED
}

model Execution {
  id                       String          @id @default(uuid()) @db.Uuid
  testSuiteId              String          @db.Uuid
  executedByUserId         String?         @db.Uuid
  executedByAgentSessionId String?         @db.Uuid
  status                   ExecutionStatus @default(IN_PROGRESS)
  startedAt                DateTime        @default(now())
  completedAt              DateTime?
  createdAt                DateTime        @default(now())

  testSuite               TestSuite                     @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)
  executedByUser          User?                         @relation(fields: [executedByUserId], references: [id])
  executedByAgentSession  AgentSession?                 @relation(fields: [executedByAgentSessionId], references: [id])
  snapshot                ExecutionSnapshot?
  preconditionResults     ExecutionPreconditionResult[]
  stepResults             ExecutionStepResult[]
  expectedResults         ExecutionExpectedResult[]

  @@index([testSuiteId])
  @@index([status])
}
```

---

## ExecutionSnapshot

実行開始時のテストスイート・テストケースのスナップショットを保持するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー、一意） |
| `snapshotData` | JSONB | NO | - | スナップショットデータ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### スナップショット構造

```json
{
  "testSuite": {
    "id": "uuid",
    "name": "テストスイート名",
    "description": "説明",
    "preconditions": [
      {
        "id": "precond-uuid-1",
        "content": "スイートの前提条件",
        "orderKey": "a"
      }
    ]
  },
  "testCases": [
    {
      "id": "case-uuid-1",
      "title": "テストケース1",
      "description": "説明",
      "priority": "HIGH",
      "orderKey": "a",
      "preconditions": [
        {
          "id": "case-precond-uuid-1",
          "content": "前提条件",
          "orderKey": "a"
        }
      ],
      "steps": [
        {
          "id": "step-uuid-1",
          "content": "手順1",
          "orderKey": "a"
        }
      ],
      "expectedResults": [
        {
          "id": "expected-uuid-1",
          "content": "期待値1",
          "orderKey": "a"
        }
      ]
    }
  ]
}
```

### Prisma スキーマ

```prisma
model ExecutionSnapshot {
  id           String   @id @default(uuid()) @db.Uuid
  executionId  String   @unique @db.Uuid
  snapshotData Json
  createdAt    DateTime @default(now())

  execution Execution @relation(fields: [executionId], references: [id], onDelete: Cascade)
}
```

---

## ExecutionPreconditionResult

各前提条件の実施結果を管理するテーブル。スナップショット内の ID で紐づけ。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー） |
| `snapshotTestCaseId` | UUID | YES | NULL | スナップショット内のテストケース ID（NULL=スイート前提条件） |
| `snapshotPreconditionId` | UUID | NO | - | スナップショット内の前提条件 ID |
| `status` | ENUM | NO | UNCHECKED | 確認ステータス |
| `checkedAt` | TIMESTAMP | YES | NULL | 確認日時 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 確認ステータス（前提条件用）

| ステータス | 説明 |
|------------|------|
| `UNCHECKED` | 未確認 |
| `MET` | 前提条件を満たしている |
| `NOT_MET` | 前提条件を満たしていない |

### Prisma スキーマ

```prisma
enum PreconditionStatus {
  UNCHECKED
  MET
  NOT_MET
}

model ExecutionPreconditionResult {
  id                      String              @id @default(uuid()) @db.Uuid
  executionId             String              @db.Uuid
  snapshotTestCaseId      String?             @db.Uuid
  snapshotPreconditionId  String              @db.Uuid
  status                  PreconditionStatus  @default(UNCHECKED)
  checkedAt               DateTime?
  note                    String?
  createdAt               DateTime            @default(now())

  execution Execution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@unique([executionId, snapshotPreconditionId])
  @@index([executionId])
}
```

---

## ExecutionStepResult

各手順の実施結果を管理するテーブル。スナップショット内の ID で紐づけ。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー） |
| `snapshotTestCaseId` | UUID | NO | - | スナップショット内のテストケース ID |
| `snapshotStepId` | UUID | NO | - | スナップショット内の手順 ID |
| `status` | ENUM | NO | PENDING | 実施ステータス |
| `executedAt` | TIMESTAMP | YES | NULL | 実施日時 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 実施ステータス（手順用）

| ステータス | 説明 |
|------------|------|
| `PENDING` | 未実施 |
| `DONE` | 実施済み |
| `SKIPPED` | スキップ |

### Prisma スキーマ

```prisma
enum StepStatus {
  PENDING
  DONE
  SKIPPED
}

model ExecutionStepResult {
  id                 String     @id @default(uuid()) @db.Uuid
  executionId        String     @db.Uuid
  snapshotTestCaseId String     @db.Uuid
  snapshotStepId     String     @db.Uuid
  status             StepStatus @default(PENDING)
  executedAt         DateTime?
  note               String?
  createdAt          DateTime   @default(now())

  execution Execution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@unique([executionId, snapshotStepId])
  @@index([executionId])
}
```

---

## ExecutionExpectedResult

各期待値の判定結果を管理するテーブル。スナップショット内の ID で紐づけ。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー） |
| `snapshotTestCaseId` | UUID | NO | - | スナップショット内のテストケース ID |
| `snapshotExpectedResultId` | UUID | NO | - | スナップショット内の期待値 ID |
| `status` | ENUM | NO | PENDING | 判定ステータス |
| `judgedAt` | TIMESTAMP | YES | NULL | 判定日時 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 判定ステータス（期待値用）

| ステータス | 説明 |
|------------|------|
| `PENDING` | 未実施 |
| `PASS` | 合格 |
| `FAIL` | 不合格 |
| `SKIPPED` | スキップ |
| `NOT_EXECUTABLE` | 実施不可（テストケースが間違っている場合に選択） |

### Prisma スキーマ

```prisma
enum JudgmentStatus {
  PENDING
  PASS
  FAIL
  SKIPPED
  NOT_EXECUTABLE
}

model ExecutionExpectedResult {
  id                        String         @id @default(uuid()) @db.Uuid
  executionId               String         @db.Uuid
  snapshotTestCaseId        String         @db.Uuid
  snapshotExpectedResultId  String         @db.Uuid
  status                    JudgmentStatus @default(PENDING)
  judgedAt                  DateTime?
  note                      String?
  createdAt                 DateTime       @default(now())

  execution Execution           @relation(fields: [executionId], references: [id], onDelete: Cascade)
  evidences ExecutionEvidence[]

  @@unique([executionId, snapshotExpectedResultId])
  @@index([executionId])
}
```

---

## ExecutionEvidence

実行結果に添付するエビデンス（スクリーンショット、ログファイル等）を管理するテーブル。期待値の判定結果に紐づけ。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `expectedResultId` | UUID | NO | - | 期待値判定結果 ID（外部キー） |
| `fileName` | VARCHAR(255) | NO | - | ファイル名 |
| `fileUrl` | TEXT | NO | - | ファイル URL（MinIO） |
| `fileType` | VARCHAR(100) | NO | - | MIME タイプ |
| `fileSize` | BIGINT | NO | - | ファイルサイズ（バイト） |
| `description` | TEXT | YES | NULL | 説明 |
| `uploadedByUserId` | UUID | YES | NULL | アップロード者ユーザー ID（外部キー）※1 |
| `uploadedByAgentSessionId` | UUID | YES | NULL | アップロード者 Agent セッション ID（外部キー）※1 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

※1: `uploadedByUserId` と `uploadedByAgentSessionId` はどちらか一方のみ設定（排他制約）

### Prisma スキーマ

```prisma
model ExecutionEvidence {
  id                        String    @id @default(uuid()) @db.Uuid
  expectedResultId          String    @db.Uuid
  fileName                  String    @db.VarChar(255)
  fileUrl                   String
  fileType                  String    @db.VarChar(100)
  fileSize                  BigInt
  description               String?
  uploadedByUserId          String?   @db.Uuid
  uploadedByAgentSessionId  String?   @db.Uuid
  createdAt                 DateTime  @default(now())

  expectedResult         ExecutionExpectedResult @relation(fields: [expectedResultId], references: [id], onDelete: Cascade)
  uploadedByUser         User?                   @relation(fields: [uploadedByUserId], references: [id])
  uploadedByAgentSession AgentSession?           @relation(fields: [uploadedByAgentSessionId], references: [id])

  @@index([expectedResultId])
}
```

---

## 実行フロー

```
1. テスト実行開始
   └─▶ Execution レコード作成（status: IN_PROGRESS）
   └─▶ ExecutionSnapshot 作成（テストスイート・ケースのスナップショット）
   └─▶ ExecutionPreconditionResult 作成（全前提条件分、スナップショット内IDで紐づけ）
   └─▶ ExecutionStepResult 作成（全手順分、スナップショット内IDで紐づけ）
   └─▶ ExecutionExpectedResult 作成（全期待値分、スナップショット内IDで紐づけ）

2. テスト実施中
   └─▶ 前提条件確認 → ExecutionPreconditionResult.status 更新
       - UNCHECKED → MET（満たしている）
       - UNCHECKED → NOT_MET（満たしていない）
   └─▶ 手順実施 → ExecutionStepResult.status 更新
       - PENDING → DONE（実施済み）
       - PENDING → SKIPPED（スキップ）
   └─▶ 期待値判定 → ExecutionExpectedResult.status 更新
       - PENDING → PASS（合格）
       - PENDING → FAIL（不合格）
       - PENDING → SKIPPED（スキップ）
       - PENDING → NOT_EXECUTABLE（実施不可）
   └─▶ エビデンス添付 → ExecutionEvidence 作成（期待値に紐づけ）

3. テスト完了
   └─▶ Execution.status → COMPLETED
   └─▶ Execution.completedAt 設定
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| EX-001 | テスト実行開始 | テストスイート単位でテストを実行 |
| EX-002 | スナップショット作成 | 実行開始時にテストスイート・テストケースをスナップショット |
| EX-003 | 繰り返し実行 | 同じテストスイートを何度でも実行可能 |
| EX-004 | 手順実施記録 | 各前提条件・手順の実施状況を記録 |
| EX-005 | 期待値判定記録 | 各期待値の合否を記録 |
| EX-006 | 実行結果一覧 | 過去の実行結果を一覧表示 |
| EX-007 | エビデンス添付 | 実行結果にファイル（スクリーンショット・ログ等）を添付 |
| AG-006 | Agent テスト実行 | Coding Agent がテストを実行 |
| AG-007 | 実施記録 | Agent が前提条件・手順を確実に実施したか記録 |
| AG-008 | リアルタイム反映 | Agent のテスト実施状況をリアルタイムで Web 画面に反映 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [テストスイート](./test-suite.md)
- [テストケース](./test-case.md)
- [Agent セッション](./agent-session.md)
