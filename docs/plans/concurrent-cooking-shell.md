# ExecutionSnapshot 正規化テーブル設計

## 概要

`ExecutionSnapshot.snapshotData`（JSONB）を正規化テーブル群に変更する。

## 新規作成テーブル（6テーブル）

### 1. ExecutionTestSuite
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

### 2. ExecutionTestSuitePrecondition
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

### 3. ExecutionTestCase
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

  executionTestSuite    ExecutionTestSuite              @relation(fields: [executionTestSuiteId], references: [id], onDelete: Cascade)
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

### 4. ExecutionTestCasePrecondition
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

### 5. ExecutionTestCaseStep
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

### 6. ExecutionTestCaseExpectedResult
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

## 既存テーブルの変更

### ExecutionPreconditionResult（変更）
```prisma
model ExecutionPreconditionResult {
  id                           String             @id @default(uuid())
  executionId                  String             @map("execution_id")
  executionTestCaseId          String?            @map("execution_test_case_id")
  executionSuitePreconditionId String?            @map("execution_suite_precondition_id")
  executionCasePreconditionId  String?            @map("execution_case_precondition_id")
  status                       PreconditionStatus @default(UNCHECKED)
  checkedAt                    DateTime?          @map("checked_at")
  note                         String?            @db.Text
  createdAt                    DateTime           @default(now()) @map("created_at")
  updatedAt                    DateTime           @updatedAt @map("updated_at")

  execution            Execution                       @relation(fields: [executionId], references: [id], onDelete: Cascade)
  executionTestCase    ExecutionTestCase?              @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  suitePrecondition    ExecutionTestSuitePrecondition? @relation(fields: [executionSuitePreconditionId], references: [id], onDelete: Cascade)
  casePrecondition     ExecutionTestCasePrecondition?  @relation(fields: [executionCasePreconditionId], references: [id], onDelete: Cascade)

  @@unique([executionId, executionSuitePreconditionId])
  @@unique([executionId, executionCasePreconditionId])
  @@index([executionId])
  @@map("execution_precondition_results")
}
```

### ExecutionStepResult（変更）
```prisma
model ExecutionStepResult {
  id                  String     @id @default(uuid())
  executionId         String     @map("execution_id")
  executionTestCaseId String     @map("execution_test_case_id")
  executionStepId     String     @map("execution_step_id")
  status              StepStatus @default(PENDING)
  executedAt          DateTime?  @map("executed_at")
  note                String?    @db.Text
  createdAt           DateTime   @default(now()) @map("created_at")
  updatedAt           DateTime   @updatedAt @map("updated_at")

  execution         Execution             @relation(fields: [executionId], references: [id], onDelete: Cascade)
  executionTestCase ExecutionTestCase     @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  executionStep     ExecutionTestCaseStep @relation(fields: [executionStepId], references: [id], onDelete: Cascade)

  @@unique([executionId, executionStepId])
  @@index([executionId])
  @@map("execution_step_results")
}
```

### ExecutionExpectedResult（変更）
```prisma
model ExecutionExpectedResult {
  id                        String         @id @default(uuid())
  executionId               String         @map("execution_id")
  executionTestCaseId       String         @map("execution_test_case_id")
  executionExpectedResultId String         @map("execution_expected_result_id")
  status                    JudgmentStatus @default(PENDING)
  judgedAt                  DateTime?      @map("judged_at")
  note                      String?        @db.Text
  createdAt                 DateTime       @default(now()) @map("created_at")
  updatedAt                 DateTime       @updatedAt @map("updated_at")

  execution               Execution                       @relation(fields: [executionId], references: [id], onDelete: Cascade)
  executionTestCase       ExecutionTestCase               @relation(fields: [executionTestCaseId], references: [id], onDelete: Cascade)
  executionExpectedResult ExecutionTestCaseExpectedResult @relation(fields: [executionExpectedResultId], references: [id], onDelete: Cascade)
  evidences               ExecutionEvidence[]

  @@unique([executionId, executionExpectedResultId])
  @@index([executionId])
  @@map("execution_expected_results")
}
```

### Execution（リレーション追加）
```prisma
// 追加するリレーション
executionTestSuite ExecutionTestSuite?
```

### 削除するテーブル
- `ExecutionSnapshot`

## カラム名変更マッピング

| 旧カラム | 新カラム |
|----------|----------|
| snapshotTestCaseId | executionTestCaseId |
| snapshotPreconditionId | executionSuitePreconditionId / executionCasePreconditionId |
| snapshotStepId | executionStepId |
| snapshotExpectedResultId | executionExpectedResultId |

## 実装手順

### Step 1: Prismaスキーマ変更
- ファイル: `packages/db/prisma/schema.prisma`
- 新規6テーブル追加
- 既存3テーブル変更（カラム名変更、外部キー追加）
- ExecutionSnapshot削除
- Executionにリレーション追加

### Step 2: マイグレーション実行
```bash
docker compose exec dev pnpm --filter @agentest/db db:migrate
```

### Step 3: サービス層更新
- ファイル: `apps/api/src/services/test-suite.service.ts`
- `startExecution()` メソッドを正規化テーブルへの挿入に変更

### Step 4: リポジトリ層更新
- ファイル: `apps/api/src/repositories/execution.repository.ts`
- `findByIdWithDetails()` のinclude構造を正規化テーブル用に変更

### Step 5: 型定義更新
- ファイル: `packages/shared/src/types/execution.ts`（存在すれば）
- ファイル: `apps/web/src/lib/api.ts`

### Step 6: テスト更新
- ファイル: `apps/api/src/__tests__/integration/test-helpers.ts`
- スナップショット作成ヘルパー関数を更新

## 修正対象ファイル

1. `packages/db/prisma/schema.prisma` - スキーマ定義
2. `apps/api/src/services/test-suite.service.ts` - startExecution()
3. `apps/api/src/repositories/execution.repository.ts` - findByIdWithDetails()
4. `apps/api/src/__tests__/integration/test-helpers.ts` - テストヘルパー
5. `apps/web/src/lib/api.ts` - フロントエンド型定義（必要に応じて）
