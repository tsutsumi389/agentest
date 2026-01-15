# テスト実行 テーブル

## 概要

テスト実行とその結果を管理するテーブル群。実行開始時に正規化テーブル群へスナップショットを作成し、実行中にテストケースが編集されても結果に影響しない設計。

## Execution

テスト実行を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `testSuiteId` | UUID | NO | - | テストスイート ID（外部キー） |
| `environmentId` | UUID | YES | NULL | 実行対象環境 ID（外部キー） |
| `executedByUserId` | UUID | YES | NULL | 実行者ユーザー ID（外部キー）※1 |
| `executedByAgentSessionId` | UUID | YES | NULL | 実行者 Agent セッション ID（外部キー）※1 |
| `status` | ENUM | NO | IN_PROGRESS | 実行ステータス |
| `startedAt` | TIMESTAMP | NO | now() | 開始日時 |
| `completedAt` | TIMESTAMP | YES | NULL | 完了日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | - | 更新日時 |

※1: `executedByUserId` と `executedByAgentSessionId` は両方 NULL または一方のみ設定可

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
  id                       String          @id @default(uuid())
  testSuiteId              String          @map("test_suite_id")
  environmentId            String?         @map("environment_id")
  executedByUserId         String?         @map("executed_by_user_id")
  executedByAgentSessionId String?         @map("executed_by_agent_session_id")
  status                   ExecutionStatus @default(IN_PROGRESS)
  startedAt                DateTime        @default(now()) @map("started_at")
  completedAt              DateTime?       @map("completed_at")
  createdAt                DateTime        @default(now()) @map("created_at")
  updatedAt                DateTime        @updatedAt @map("updated_at")

  testSuite           TestSuite                     @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)
  environment         ProjectEnvironment?           @relation(fields: [environmentId], references: [id])
  executedByUser      User?                         @relation("ExecutionUser", fields: [executedByUserId], references: [id])
  agentSession        AgentSession?                 @relation(fields: [executedByAgentSessionId], references: [id])
  executionTestSuite  ExecutionTestSuite?
  preconditionResults ExecutionPreconditionResult[]
  stepResults         ExecutionStepResult[]
  expectedResults     ExecutionExpectedResult[]

  @@index([testSuiteId])
  @@index([status])
  @@index([startedAt])
  @@map("executions")
}
```

---

## ExecutionTestSuite

実行開始時のテストスイートのスナップショットを保持するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー、一意） |
| `originalTestSuiteId` | UUID | NO | - | 元のテストスイート ID |
| `name` | VARCHAR(200) | NO | - | テストスイート名（スナップショット） |
| `description` | TEXT | YES | NULL | 説明（スナップショット） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### Prisma スキーマ

```prisma
model ExecutionTestSuite {
  id                  String   @id @default(uuid())
  executionId         String   @unique @map("execution_id")
  originalTestSuiteId String   @map("original_test_suite_id")
  name                String   @db.VarChar(200)
  description         String?  @db.Text
  createdAt           DateTime @default(now()) @map("created_at")

  execution     Execution                        @relation(fields: [executionId], references: [id], onDelete: Cascade)
  preconditions ExecutionTestSuitePrecondition[]
  testCases     ExecutionTestCase[]

  @@map("execution_test_suites")
}
```

---

## ExecutionTestSuitePrecondition

テストスイート前提条件のスナップショットを保持するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionTestSuiteId` | UUID | NO | - | 実行テストスイート ID（外部キー） |
| `originalPreconditionId` | UUID | NO | - | 元の前提条件 ID |
| `content` | TEXT | NO | - | 前提条件の内容（スナップショット） |
| `orderKey` | VARCHAR(255) | NO | - | 並び順キー |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### Prisma スキーマ

```prisma
model ExecutionTestSuitePrecondition {
  id                     String   @id @default(uuid())
  executionTestSuiteId   String   @map("execution_test_suite_id")
  originalPreconditionId String   @map("original_precondition_id")
  content                String   @db.Text
  orderKey               String   @map("order_key") @db.VarChar(255)
  createdAt              DateTime @default(now()) @map("created_at")

  executionTestSuite  ExecutionTestSuite            @relation(fields: [executionTestSuiteId], references: [id], onDelete: Cascade)
  preconditionResults ExecutionPreconditionResult[]

  @@index([executionTestSuiteId])
  @@index([executionTestSuiteId, orderKey])
  @@map("execution_test_suite_preconditions")
}
```

---

## ExecutionTestCase

テストケースのスナップショットを保持するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionTestSuiteId` | UUID | NO | - | 実行テストスイート ID（外部キー） |
| `originalTestCaseId` | UUID | NO | - | 元のテストケース ID |
| `title` | VARCHAR(200) | NO | - | タイトル（スナップショット） |
| `description` | TEXT | YES | NULL | 説明（スナップショット） |
| `priority` | ENUM | NO | - | 優先度（スナップショット） |
| `orderKey` | VARCHAR(255) | NO | - | 並び順キー |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### Prisma スキーマ

```prisma
model ExecutionTestCase {
  id                   String           @id @default(uuid())
  executionTestSuiteId String           @map("execution_test_suite_id")
  originalTestCaseId   String           @map("original_test_case_id")
  title                String           @db.VarChar(200)
  description          String?          @db.Text
  priority             TestCasePriority
  orderKey             String           @map("order_key") @db.VarChar(255)
  createdAt            DateTime         @default(now()) @map("created_at")

  executionTestSuite    ExecutionTestSuite                @relation(fields: [executionTestSuiteId], references: [id], onDelete: Cascade)
  preconditions         ExecutionTestCasePrecondition[]
  steps                 ExecutionTestCaseStep[]
  expectedResults       ExecutionTestCaseExpectedResult[]
  preconditionResults   ExecutionPreconditionResult[]
  stepResults           ExecutionStepResult[]
  expectedResultResults ExecutionExpectedResult[]

  @@index([executionTestSuiteId])
  @@index([executionTestSuiteId, orderKey])
  @@map("execution_test_cases")
}
```

---

## ExecutionTestCasePrecondition

テストケース前提条件のスナップショットを保持するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionTestCaseId` | UUID | NO | - | 実行テストケース ID（外部キー） |
| `originalPreconditionId` | UUID | NO | - | 元の前提条件 ID |
| `content` | TEXT | NO | - | 前提条件の内容（スナップショット） |
| `orderKey` | VARCHAR(255) | NO | - | 並び順キー |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### Prisma スキーマ

```prisma
model ExecutionTestCasePrecondition {
  id                     String   @id @default(uuid())
  executionTestCaseId    String   @map("execution_test_case_id")
  originalPreconditionId String   @map("original_precondition_id")
  content                String   @db.Text
  orderKey               String   @map("order_key") @db.VarChar(255)
  createdAt              DateTime @default(now()) @map("created_at")

  executionTestCase   ExecutionTestCase             @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  preconditionResults ExecutionPreconditionResult[]

  @@index([executionTestCaseId])
  @@index([executionTestCaseId, orderKey])
  @@map("execution_test_case_preconditions")
}
```

---

## ExecutionTestCaseStep

テストケース手順のスナップショットを保持するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionTestCaseId` | UUID | NO | - | 実行テストケース ID（外部キー） |
| `originalStepId` | UUID | NO | - | 元の手順 ID |
| `content` | TEXT | NO | - | 手順の内容（スナップショット） |
| `orderKey` | VARCHAR(255) | NO | - | 並び順キー |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### Prisma スキーマ

```prisma
model ExecutionTestCaseStep {
  id                  String   @id @default(uuid())
  executionTestCaseId String   @map("execution_test_case_id")
  originalStepId      String   @map("original_step_id")
  content             String   @db.Text
  orderKey            String   @map("order_key") @db.VarChar(255)
  createdAt           DateTime @default(now()) @map("created_at")

  executionTestCase ExecutionTestCase     @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  stepResults       ExecutionStepResult[]

  @@index([executionTestCaseId])
  @@index([executionTestCaseId, orderKey])
  @@map("execution_test_case_steps")
}
```

---

## ExecutionTestCaseExpectedResult

テストケース期待結果のスナップショットを保持するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionTestCaseId` | UUID | NO | - | 実行テストケース ID（外部キー） |
| `originalExpectedResultId` | UUID | NO | - | 元の期待結果 ID |
| `content` | TEXT | NO | - | 期待結果の内容（スナップショット） |
| `orderKey` | VARCHAR(255) | NO | - | 並び順キー |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### Prisma スキーマ

```prisma
model ExecutionTestCaseExpectedResult {
  id                       String   @id @default(uuid())
  executionTestCaseId      String   @map("execution_test_case_id")
  originalExpectedResultId String   @map("original_expected_result_id")
  content                  String   @db.Text
  orderKey                 String   @map("order_key") @db.VarChar(255)
  createdAt                DateTime @default(now()) @map("created_at")

  executionTestCase ExecutionTestCase         @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  expectedResults   ExecutionExpectedResult[]

  @@index([executionTestCaseId])
  @@index([executionTestCaseId, orderKey])
  @@map("execution_test_case_expected_results")
}
```

---

## ExecutionPreconditionResult

各前提条件の実施結果を管理するテーブル。スイート前提条件とテストケース前提条件の両方に対応。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー） |
| `executionTestCaseId` | UUID | YES | NULL | 実行テストケース ID（テストケース前提条件の場合） |
| `executionSuitePreconditionId` | UUID | YES | NULL | 実行スイート前提条件 ID（スイート前提条件の場合） |
| `executionCasePreconditionId` | UUID | YES | NULL | 実行ケース前提条件 ID（テストケース前提条件の場合） |
| `status` | ENUM | NO | UNCHECKED | 確認ステータス |
| `checkedAt` | TIMESTAMP | YES | NULL | 確認日時 |
| `checkedByUserId` | UUID | YES | NULL | 確認者ユーザー ID（外部キー） |
| `checkedByAgentName` | VARCHAR(100) | YES | NULL | 確認者 AI エージェント名 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | - | 更新日時 |

※ `executionSuitePreconditionId` と `executionCasePreconditionId` はどちらか一方のみ設定
※ `checkedByUserId` と `checkedByAgentName` は Web 経由では userId のみ、MCP ツール経由では両方設定可能

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
  id                           String             @id @default(uuid())
  executionId                  String             @map("execution_id")
  executionTestCaseId          String?            @map("execution_test_case_id")
  executionSuitePreconditionId String?            @map("execution_suite_precondition_id")
  executionCasePreconditionId  String?            @map("execution_case_precondition_id")
  status                       PreconditionStatus @default(UNCHECKED)
  checkedAt                    DateTime?          @map("checked_at")
  checkedByUserId              String?            @map("checked_by_user_id")
  checkedByAgentName           String?            @map("checked_by_agent_name") @db.VarChar(100)
  note                         String?            @db.Text
  createdAt                    DateTime           @default(now()) @map("created_at")
  updatedAt                    DateTime           @updatedAt @map("updated_at")

  execution         Execution                       @relation(fields: [executionId], references: [id], onDelete: Cascade)
  executionTestCase ExecutionTestCase?              @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  suitePrecondition ExecutionTestSuitePrecondition? @relation(fields: [executionSuitePreconditionId], references: [id], onDelete: Cascade)
  casePrecondition  ExecutionTestCasePrecondition?  @relation(fields: [executionCasePreconditionId], references: [id], onDelete: Cascade)
  checkedByUser     User?                           @relation("PreconditionResultChecker", fields: [checkedByUserId], references: [id])

  @@unique([executionId, executionSuitePreconditionId])
  @@unique([executionId, executionCasePreconditionId])
  @@index([executionId])
  @@map("execution_precondition_results")
}
```

---

## ExecutionStepResult

各手順の実施結果を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー） |
| `executionTestCaseId` | UUID | NO | - | 実行テストケース ID（外部キー） |
| `executionStepId` | UUID | NO | - | 実行ステップ ID（外部キー） |
| `status` | ENUM | NO | PENDING | 実施ステータス |
| `executedAt` | TIMESTAMP | YES | NULL | 実施日時 |
| `executedByUserId` | UUID | YES | NULL | 実施者ユーザー ID（外部キー） |
| `executedByAgentName` | VARCHAR(100) | YES | NULL | 実施者 AI エージェント名 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | - | 更新日時 |

※ `executedByUserId` と `executedByAgentName` は Web 経由では userId のみ、MCP ツール経由では両方設定可能

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
  id                  String     @id @default(uuid())
  executionId         String     @map("execution_id")
  executionTestCaseId String     @map("execution_test_case_id")
  executionStepId     String     @map("execution_step_id")
  status              StepStatus @default(PENDING)
  executedAt          DateTime?  @map("executed_at")
  executedByUserId    String?    @map("executed_by_user_id")
  executedByAgentName String?    @map("executed_by_agent_name") @db.VarChar(100)
  note                String?    @db.Text
  createdAt           DateTime   @default(now()) @map("created_at")
  updatedAt           DateTime   @updatedAt @map("updated_at")

  execution         Execution             @relation(fields: [executionId], references: [id], onDelete: Cascade)
  executionTestCase ExecutionTestCase     @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  executionStep     ExecutionTestCaseStep @relation(fields: [executionStepId], references: [id], onDelete: Cascade)
  executedByUser    User?                 @relation("StepResultExecutor", fields: [executedByUserId], references: [id])

  @@unique([executionId, executionStepId])
  @@index([executionId])
  @@map("execution_step_results")
}
```

---

## ExecutionExpectedResult

各期待値の判定結果を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー） |
| `executionTestCaseId` | UUID | NO | - | 実行テストケース ID（外部キー） |
| `executionExpectedResultId` | UUID | NO | - | 実行期待結果 ID（外部キー） |
| `status` | ENUM | NO | PENDING | 判定ステータス |
| `judgedAt` | TIMESTAMP | YES | NULL | 判定日時 |
| `judgedByUserId` | UUID | YES | NULL | 判定者ユーザー ID（外部キー） |
| `judgedByAgentName` | VARCHAR(100) | YES | NULL | 判定者 AI エージェント名 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | - | 更新日時 |

※ `judgedByUserId` と `judgedByAgentName` は Web 経由では userId のみ、MCP ツール経由では両方設定可能

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
  id                        String         @id @default(uuid())
  executionId               String         @map("execution_id")
  executionTestCaseId       String         @map("execution_test_case_id")
  executionExpectedResultId String         @map("execution_expected_result_id")
  status                    JudgmentStatus @default(PENDING)
  judgedAt                  DateTime?      @map("judged_at")
  judgedByUserId            String?        @map("judged_by_user_id")
  judgedByAgentName         String?        @map("judged_by_agent_name") @db.VarChar(100)
  note                      String?        @db.Text
  createdAt                 DateTime       @default(now()) @map("created_at")
  updatedAt                 DateTime       @updatedAt @map("updated_at")

  execution               Execution                       @relation(fields: [executionId], references: [id], onDelete: Cascade)
  executionTestCase       ExecutionTestCase               @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  executionExpectedResult ExecutionTestCaseExpectedResult @relation(fields: [executionExpectedResultId], references: [id], onDelete: Cascade)
  evidences               ExecutionEvidence[]
  judgedByUser            User?                           @relation("ExpectedResultJudger", fields: [judgedByUserId], references: [id])

  @@unique([executionId, executionExpectedResultId])
  @@index([executionId])
  @@map("execution_expected_results")
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

※1: `uploadedByUserId` と `uploadedByAgentSessionId` はどちらか一方のみ設定可

### Prisma スキーマ

```prisma
model ExecutionEvidence {
  id                        String    @id @default(uuid())
  expectedResultId          String    @map("expected_result_id")
  fileName                  String    @map("file_name") @db.VarChar(255)
  fileUrl                   String    @map("file_url")
  fileType                  String    @map("file_type") @db.VarChar(100)
  fileSize                  BigInt    @map("file_size")
  description               String?   @db.Text
  uploadedByUserId          String?   @map("uploaded_by_user_id")
  uploadedByAgentSessionId  String?   @map("uploaded_by_agent_session_id")
  createdAt                 DateTime  @default(now()) @map("created_at")

  expectedResult ExecutionExpectedResult @relation(fields: [expectedResultId], references: [id], onDelete: Cascade)
  uploadedBy     User?                   @relation("EvidenceUploader", fields: [uploadedByUserId], references: [id])
  agentSession   AgentSession?           @relation(fields: [uploadedByAgentSessionId], references: [id])

  @@index([expectedResultId])
  @@map("execution_evidences")
}
```

---

## ER 図

```
Execution
    │
    ├──1:1── ExecutionTestSuite
    │            │
    │            ├──1:N── ExecutionTestSuitePrecondition ──1:N── ExecutionPreconditionResult
    │            │
    │            └──1:N── ExecutionTestCase
    │                         │
    │                         ├──1:N── ExecutionTestCasePrecondition ──1:N── ExecutionPreconditionResult
    │                         │
    │                         ├──1:N── ExecutionTestCaseStep ──1:N── ExecutionStepResult
    │                         │
    │                         └──1:N── ExecutionTestCaseExpectedResult ──1:N── ExecutionExpectedResult
    │                                                                              │
    │                                                                              └──1:N── ExecutionEvidence
    │
    ├──1:N── ExecutionPreconditionResult
    ├──1:N── ExecutionStepResult
    └──1:N── ExecutionExpectedResult
```

---

## 実行フロー

```
1. テスト実行開始
   └─▶ Execution レコード作成（status: IN_PROGRESS）
   └─▶ ExecutionTestSuite 作成（テストスイートのスナップショット）
   └─▶ ExecutionTestSuitePrecondition 作成（スイート前提条件のスナップショット）
   └─▶ ExecutionTestCase 作成（各テストケースのスナップショット）
       └─▶ ExecutionTestCasePrecondition 作成（ケース前提条件のスナップショット）
       └─▶ ExecutionTestCaseStep 作成（手順のスナップショット）
       └─▶ ExecutionTestCaseExpectedResult 作成（期待結果のスナップショット）
   └─▶ ExecutionPreconditionResult 作成（全前提条件分、スナップショットテーブルのIDで紐づけ）
   └─▶ ExecutionStepResult 作成（全手順分、スナップショットテーブルのIDで紐づけ）
   └─▶ ExecutionExpectedResult 作成（全期待値分、スナップショットテーブルのIDで紐づけ）

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
| EX-001 | テスト実行開始 | テストスイート単位でテストを実行（対象環境を選択） |
| EX-002 | スナップショット作成 | 実行開始時にテストスイート・テストケースを正規化テーブルへスナップショット |
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
- [組織・プロジェクト](./organization.md)（ProjectEnvironment）
- [テストスイート](./test-suite.md)
- [テストケース](./test-case.md)
- [Agent セッション](./agent-session.md)
