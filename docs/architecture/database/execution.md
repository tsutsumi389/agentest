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
| `executedBy` | UUID | NO | - | 実行者 ID |
| `executedByType` | ENUM | NO | USER | 実行者種別（USER, AGENT） |
| `status` | ENUM | NO | IN_PROGRESS | 実行ステータス |
| `startedAt` | TIMESTAMP | NO | now() | 開始日時 |
| `completedAt` | TIMESTAMP | YES | NULL | 完了日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

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
  id             String          @id @default(uuid()) @db.Uuid
  testSuiteId    String          @db.Uuid
  executedBy     String          @db.Uuid
  executedByType ActorType       @default(USER)
  status         ExecutionStatus @default(IN_PROGRESS)
  startedAt      DateTime        @default(now())
  completedAt    DateTime?
  createdAt      DateTime        @default(now())

  testSuite           TestSuite                   @relation(fields: [testSuiteId], references: [id], onDelete: Cascade)
  executor            User                        @relation(fields: [executedBy], references: [id])
  snapshot            ExecutionSnapshot?
  preconditionResults ExecutionPreconditionResult[]
  stepResults         ExecutionStepResult[]
  expectedResults     ExecutionExpectedResult[]
  evidences           ExecutionEvidence[]

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
        "content": "スイートの前提条件",
        "orderIndex": 0
      }
    ]
  },
  "testCases": [
    {
      "id": "uuid",
      "title": "テストケース1",
      "description": "説明",
      "priority": "HIGH",
      "preconditions": [
        {
          "content": "前提条件",
          "orderIndex": 0
        }
      ],
      "steps": [
        {
          "content": "手順1",
          "orderIndex": 0
        }
      ],
      "expectedResults": [
        {
          "content": "期待値1",
          "orderIndex": 0
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

各前提条件の実施結果を管理するテーブル。スイートとケース両方の前提条件を記録。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー） |
| `testCaseId` | UUID | YES | NULL | テストケース ID（NULL=スイート前提条件） |
| `preconditionIndex` | INTEGER | NO | - | 前提条件のインデックス |
| `status` | ENUM | NO | PENDING | 実施ステータス |
| `executedAt` | TIMESTAMP | YES | NULL | 実施日時 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 実施ステータス

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

model ExecutionPreconditionResult {
  id                String     @id @default(uuid()) @db.Uuid
  executionId       String     @db.Uuid
  testCaseId        String?    @db.Uuid
  preconditionIndex Int
  status            StepStatus @default(PENDING)
  executedAt        DateTime?
  note              String?
  createdAt         DateTime   @default(now())

  execution Execution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@index([executionId])
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
| `testCaseId` | UUID | NO | - | テストケース ID |
| `stepIndex` | INTEGER | NO | - | 手順のインデックス |
| `status` | ENUM | NO | PENDING | 実施ステータス |
| `executedAt` | TIMESTAMP | YES | NULL | 実施日時 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### Prisma スキーマ

```prisma
model ExecutionStepResult {
  id          String     @id @default(uuid()) @db.Uuid
  executionId String     @db.Uuid
  testCaseId  String     @db.Uuid
  stepIndex   Int
  status      StepStatus @default(PENDING)
  executedAt  DateTime?
  note        String?
  createdAt   DateTime   @default(now())

  execution Execution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@index([executionId])
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
| `testCaseId` | UUID | NO | - | テストケース ID |
| `expectedResultIndex` | INTEGER | NO | - | 期待値のインデックス |
| `status` | ENUM | NO | PENDING | 判定ステータス |
| `judgedAt` | TIMESTAMP | YES | NULL | 判定日時 |
| `note` | TEXT | YES | NULL | メモ |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 判定ステータス

| ステータス | 説明 |
|------------|------|
| `PENDING` | 未判定 |
| `PASS` | 合格 |
| `FAIL` | 不合格 |
| `SKIPPED` | スキップ |

### Prisma スキーマ

```prisma
enum JudgmentStatus {
  PENDING
  PASS
  FAIL
  SKIPPED
}

model ExecutionExpectedResult {
  id                  String         @id @default(uuid()) @db.Uuid
  executionId         String         @db.Uuid
  testCaseId          String         @db.Uuid
  expectedResultIndex Int
  status              JudgmentStatus @default(PENDING)
  judgedAt            DateTime?
  note                String?
  createdAt           DateTime       @default(now())

  execution Execution @relation(fields: [executionId], references: [id], onDelete: Cascade)

  @@index([executionId])
}
```

---

## ExecutionEvidence

実行結果に添付するエビデンス（スクリーンショット、ログファイル等）を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `executionId` | UUID | NO | - | 実行 ID（外部キー） |
| `testCaseId` | UUID | YES | NULL | テストケース ID（NULL=スイート全体） |
| `fileName` | VARCHAR(255) | NO | - | ファイル名 |
| `fileUrl` | TEXT | NO | - | ファイル URL（MinIO） |
| `fileType` | VARCHAR(100) | NO | - | MIME タイプ |
| `fileSize` | BIGINT | NO | - | ファイルサイズ（バイト） |
| `description` | TEXT | YES | NULL | 説明 |
| `uploadedBy` | UUID | NO | - | アップロード者 ID |
| `uploadedByType` | ENUM | NO | USER | アップロード者種別 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### Prisma スキーマ

```prisma
model ExecutionEvidence {
  id             String    @id @default(uuid()) @db.Uuid
  executionId    String    @db.Uuid
  testCaseId     String?   @db.Uuid
  fileName       String    @db.VarChar(255)
  fileUrl        String
  fileType       String    @db.VarChar(100)
  fileSize       BigInt
  description    String?
  uploadedBy     String    @db.Uuid
  uploadedByType ActorType @default(USER)
  createdAt      DateTime  @default(now())

  execution Execution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  uploader  User      @relation(fields: [uploadedBy], references: [id])

  @@index([executionId])
}
```

---

## 実行フロー

```
1. テスト実行開始
   └─▶ Execution レコード作成（status: IN_PROGRESS）
   └─▶ ExecutionSnapshot 作成（テストスイート・ケースのスナップショット）
   └─▶ ExecutionPreconditionResult 作成（全前提条件分）
   └─▶ ExecutionStepResult 作成（全手順分）
   └─▶ ExecutionExpectedResult 作成（全期待値分）

2. テスト実施中
   └─▶ 前提条件確認 → ExecutionPreconditionResult 更新
   └─▶ 手順実施 → ExecutionStepResult 更新
   └─▶ 期待値判定 → ExecutionExpectedResult 更新
   └─▶ エビデンス添付 → ExecutionEvidence 作成

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
