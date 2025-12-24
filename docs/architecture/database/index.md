# データベース設計

## 概要

PostgreSQL を使用。Prisma ORM でスキーマ管理。

## テーブル一覧

### 認証関連

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `User` | ユーザー情報 | [auth.md](./auth.md#user) |
| `Account` | OAuth アカウント（GitHub, Google） | [auth.md](./auth.md#account) |
| `RefreshToken` | JWT リフレッシュトークン | [auth.md](./auth.md#refreshtoken) |

### 組織・プロジェクト

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `Organization` | 組織（チーム） | [organization.md](./organization.md#organization) |
| `OrganizationMember` | 組織メンバー（多対多） | [organization.md](./organization.md#organizationmember) |
| `Project` | プロジェクト | [organization.md](./organization.md#project) |
| `ProjectHistory` | プロジェクトの変更履歴 | [organization.md](./organization.md#projecthistory) |

### テストスイート

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `TestSuite` | テストスイート（テストケースのグループ） | [test-suite.md](./test-suite.md#testsuite) |
| `TestSuitePrecondition` | テストスイートの前提条件 | [test-suite.md](./test-suite.md#testsuiteprecondition) |
| `TestSuiteHistory` | テストスイートの変更履歴 | [test-suite.md](./test-suite.md#testsuitehistory) |

### テストケース

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `TestCase` | テストケース | [test-case.md](./test-case.md#testcase) |
| `TestCasePrecondition` | テストケースの前提条件 | [test-case.md](./test-case.md#testcaseprecondition) |
| `TestCaseStep` | テストケースの手順 | [test-case.md](./test-case.md#testcasestep) |
| `TestCaseExpectedResult` | テストケースの期待値 | [test-case.md](./test-case.md#testcaseexpectedresult) |
| `TestCaseHistory` | テストケースの変更履歴 | [test-case.md](./test-case.md#testcasehistory) |

### テスト実行

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `Execution` | テスト実行 | [execution.md](./execution.md#execution) |
| `ExecutionSnapshot` | 実行時のスナップショット | [execution.md](./execution.md#executionsnapshot) |
| `ExecutionPreconditionResult` | 前提条件の実施結果 | [execution.md](./execution.md#executionpreconditionresult) |
| `ExecutionStepResult` | 手順の実施結果 | [execution.md](./execution.md#executionstepresult) |
| `ExecutionExpectedResult` | 期待値の判定結果 | [execution.md](./execution.md#executionexpectedresult) |
| `ExecutionEvidence` | エビデンス（添付ファイル） | [execution.md](./execution.md#executionevidence) |

### レビュー

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `ReviewComment` | レビューコメント | [review.md](./review.md#reviewcomment) |
| `ReviewCommentReply` | レビューコメントへの返信 | [review.md](./review.md#reviewcommentreply) |

### 同時編集制御

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `EditLock` | 編集ロック管理 | [edit-lock.md](./edit-lock.md#editlock) |

## ER 図

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    認証関連                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐                │
│  │     User     │       │   Account    │       │ RefreshToken │                │
│  ├──────────────┤       ├──────────────┤       ├──────────────┤                │
│  │ id           │◀──────│ userId       │       │ id           │                │
│  │ email        │       │ id           │       │ userId       │───────────┐    │
│  │ name         │       │ provider     │       │ token        │           │    │
│  │ avatarUrl    │       │ providerAccId│       │ expiresAt    │           │    │
│  │ createdAt    │       │ accessToken  │       │ createdAt    │           │    │
│  │ updatedAt    │       │ refreshToken │       └──────────────┘           │    │
│  └──────────────┘       │ createdAt    │                                  │    │
│         │               └──────────────┘                                  │    │
│         │                                                                 │    │
└─────────┼─────────────────────────────────────────────────────────────────┼────┘
          │                                                                 │
          ▼                                                                 │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              組織・プロジェクト                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐       ┌─────────────────────┐       ┌──────────────┐         │
│  │ Organization │       │ OrganizationMember  │       │   Project    │         │
│  ├──────────────┤       ├─────────────────────┤       ├──────────────┤         │
│  │ id           │◀──────│ organizationId      │       │ id           │         │
│  │ name         │       │ userId              │◀──────│ organizationId│        │
│  │ slug         │       │ role                │       │ ownerId      │◀────────┘
│  │ createdAt    │       │ joinedAt            │       │ name         │
│  │ updatedAt    │       └─────────────────────┘       │ description  │
│  │ deletedAt    │                                     │ createdAt    │
│  └──────────────┘                                     │ updatedAt    │
│                                                       │ deletedAt    │
│                                                       └──────────────┘
│                                                              │
│                                                              │
│                               ┌──────────────────────────────┤
│                               │                              │
│                               ▼                              ▼
│                        ┌──────────────┐              ┌──────────────┐
│                        │ProjectHistory│              │  TestSuite   │
│                        ├──────────────┤              ├──────────────┤
│                        │ id           │              │ id           │
│                        │ projectId    │              │ projectId    │
│                        │ changedBy    │              │ name         │
│                        │ changedByType│              │ description  │
│                        │ changeType   │              │ createdAt    │
│                        │ snapshot     │              │ updatedAt    │
│                        │ createdAt    │              │ deletedAt    │
│                        └──────────────┘              └──────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┼────────────────────┘
                                                              │
┌─────────────────────────────────────────────────────────────┼────────────────────┐
│                           テストスイート                     │                    │
├─────────────────────────────────────────────────────────────┼────────────────────┤
│                                                              │                    │
│         ┌────────────────────────────────────────────────────┤                    │
│         │                                                    │                    │
│         ▼                                                    ▼                    │
│  ┌─────────────────────┐                            ┌──────────────┐             │
│  │TestSuitePrecondition│                            │TestSuiteHist │             │
│  ├─────────────────────┤                            ├──────────────┤             │
│  │ id                  │                            │ id           │             │
│  │ testSuiteId         │                            │ testSuiteId  │             │
│  │ content             │                            │ changedBy    │             │
│  │ orderIndex          │                            │ changedByType│             │
│  │ createdAt           │                            │ changeType   │             │
│  │ updatedAt           │                            │ snapshot     │             │
│  └─────────────────────┘                            │ createdAt    │             │
│                                                     └──────────────┘             │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────┐
│                              テストケース                                          │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│                              ┌──────────────┐                                     │
│                              │   TestCase   │                                     │
│                              ├──────────────┤                                     │
│                              │ id           │                                     │
│                              │ testSuiteId  │──────▶ TestSuite                    │
│                              │ title        │                                     │
│                              │ description  │                                     │
│                              │ priority     │                                     │
│                              │ createdAt    │                                     │
│                              │ updatedAt    │                                     │
│                              │ deletedAt    │                                     │
│                              └──────────────┘                                     │
│                                     │                                             │
│          ┌──────────────────────────┼──────────────────────────┐                 │
│          │                          │                          │                 │
│          ▼                          ▼                          ▼                 │
│  ┌─────────────────────┐   ┌──────────────┐   ┌─────────────────────────┐        │
│  │TestCasePrecondition │   │ TestCaseStep │   │TestCaseExpectedResult   │        │
│  ├─────────────────────┤   ├──────────────┤   ├─────────────────────────┤        │
│  │ id                  │   │ id           │   │ id                      │        │
│  │ testCaseId          │   │ testCaseId   │   │ testCaseId              │        │
│  │ content             │   │ content      │   │ content                 │        │
│  │ orderIndex          │   │ orderIndex   │   │ orderIndex              │        │
│  │ createdAt           │   │ createdAt    │   │ createdAt               │        │
│  │ updatedAt           │   │ updatedAt    │   │ updatedAt               │        │
│  └─────────────────────┘   └──────────────┘   └─────────────────────────┘        │
│                                                                                   │
│                              ┌──────────────┐                                     │
│                              │TestCaseHist  │                                     │
│                              ├──────────────┤                                     │
│                              │ id           │                                     │
│                              │ testCaseId   │──────▶ TestCase                     │
│                              │ changedBy    │                                     │
│                              │ changedByType│                                     │
│                              │ changeType   │                                     │
│                              │ snapshot     │                                     │
│                              │ createdAt    │                                     │
│                              └──────────────┘                                     │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────┐
│                                テスト実行                                          │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│                              ┌──────────────┐                                     │
│                              │  Execution   │                                     │
│                              ├──────────────┤                                     │
│                              │ id           │                                     │
│                              │ testSuiteId  │──────▶ TestSuite                    │
│                              │ snapshotId   │──────▶ ExecutionSnapshot            │
│                              │ executedBy   │──────▶ User                         │
│                              │ executedByTyp│                                     │
│                              │ status       │                                     │
│                              │ startedAt    │                                     │
│                              │ completedAt  │                                     │
│                              └──────────────┘                                     │
│                                     │                                             │
│                                     ▼                                             │
│                           ┌───────────────────┐                                   │
│                           │ExecutionSnapshot  │                                   │
│                           ├───────────────────┤                                   │
│                           │ id                │                                   │
│                           │ executionId       │                                   │
│                           │ snapshotData      │ ◀─ JSON: スイート・ケース全体     │
│                           │ createdAt         │                                   │
│                           └───────────────────┘                                   │
│                                                                                   │
│  ┌─────────────────────────┐  ┌──────────────────┐  ┌────────────────────────┐   │
│  │ExecutionPrecondResult   │  │ExecutionStepRes  │  │ExecutionExpectedResult │   │
│  ├─────────────────────────┤  ├──────────────────┤  ├────────────────────────┤   │
│  │ id                      │  │ id               │  │ id                     │   │
│  │ executionId             │  │ executionId      │  │ executionId            │   │
│  │ testCaseId              │  │ testCaseId       │  │ testCaseId             │   │
│  │ preconditionIndex       │  │ stepIndex        │  │ expectedResultIndex    │   │
│  │ status                  │  │ status           │  │ status                 │   │
│  │ executedAt              │  │ executedAt       │  │ judgedAt               │   │
│  │ note                    │  │ note             │  │ note                   │   │
│  └─────────────────────────┘  └──────────────────┘  └────────────────────────┘   │
│                                                                                   │
│                           ┌───────────────────┐                                   │
│                           │ExecutionEvidence  │                                   │
│                           ├───────────────────┤                                   │
│                           │ id                │                                   │
│                           │ executionId       │                                   │
│                           │ testCaseId        │                                   │
│                           │ fileName          │                                   │
│                           │ fileUrl           │                                   │
│                           │ fileType          │                                   │
│                           │ fileSize          │                                   │
│                           │ uploadedBy        │                                   │
│                           │ createdAt         │                                   │
│                           └───────────────────┘                                   │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────┐
│                                レビュー                                            │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  ┌──────────────┐              ┌─────────────────────┐                            │
│  │ReviewComment │              │ReviewCommentReply   │                            │
│  ├──────────────┤              ├─────────────────────┤                            │
│  │ id           │◀─────────────│ commentId           │                            │
│  │ targetType   │              │ id                  │                            │
│  │ targetId     │              │ authorId            │──────▶ User                │
│  │ authorId     │──────▶ User  │ authorType          │                            │
│  │ authorType   │              │ content             │                            │
│  │ content      │              │ createdAt           │                            │
│  │ status       │              │ updatedAt           │                            │
│  │ createdAt    │              └─────────────────────┘                            │
│  │ updatedAt    │                                                                 │
│  └──────────────┘                                                                 │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────┐
│                              同時編集制御                                          │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  ┌──────────────┐                                                                 │
│  │  EditLock    │                                                                 │
│  ├──────────────┤                                                                 │
│  │ id           │                                                                 │
│  │ targetType   │ ◀─ SUITE / CASE                                                │
│  │ targetId     │                                                                 │
│  │ lockedBy     │──────▶ User / Agent                                            │
│  │ lockedByType │ ◀─ USER / AGENT                                                │
│  │ lockedAt     │                                                                 │
│  │ lastHeartbeat│                                                                 │
│  │ expiresAt    │                                                                 │
│  └──────────────┘                                                                 │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## インデックス戦略

```sql
-- 認証関連
CREATE INDEX idx_accounts_user_id ON "Account"("userId");
CREATE INDEX idx_refresh_tokens_user_id ON "RefreshToken"("userId");
CREATE INDEX idx_refresh_tokens_token ON "RefreshToken"("token");

-- 組織・プロジェクト
CREATE INDEX idx_org_members_user_id ON "OrganizationMember"("userId");
CREATE INDEX idx_org_members_org_id ON "OrganizationMember"("organizationId");
CREATE INDEX idx_projects_org_id ON "Project"("organizationId");
CREATE INDEX idx_projects_owner_id ON "Project"("ownerId");
CREATE INDEX idx_project_history_project_id ON "ProjectHistory"("projectId");

-- テストスイート
CREATE INDEX idx_test_suites_project_id ON "TestSuite"("projectId");
CREATE INDEX idx_suite_preconditions_suite_id ON "TestSuitePrecondition"("testSuiteId");
CREATE INDEX idx_suite_history_suite_id ON "TestSuiteHistory"("testSuiteId");

-- テストケース
CREATE INDEX idx_test_cases_suite_id ON "TestCase"("testSuiteId");
CREATE INDEX idx_case_preconditions_case_id ON "TestCasePrecondition"("testCaseId");
CREATE INDEX idx_case_steps_case_id ON "TestCaseStep"("testCaseId");
CREATE INDEX idx_case_expected_case_id ON "TestCaseExpectedResult"("testCaseId");
CREATE INDEX idx_case_history_case_id ON "TestCaseHistory"("testCaseId");

-- テスト実行
CREATE INDEX idx_executions_suite_id ON "Execution"("testSuiteId");
CREATE INDEX idx_executions_status ON "Execution"("status");
CREATE INDEX idx_exec_precond_execution_id ON "ExecutionPreconditionResult"("executionId");
CREATE INDEX idx_exec_step_execution_id ON "ExecutionStepResult"("executionId");
CREATE INDEX idx_exec_expected_execution_id ON "ExecutionExpectedResult"("executionId");
CREATE INDEX idx_exec_evidence_execution_id ON "ExecutionEvidence"("executionId");

-- レビュー
CREATE INDEX idx_review_comments_target ON "ReviewComment"("targetType", "targetId");
CREATE INDEX idx_review_replies_comment_id ON "ReviewCommentReply"("commentId");

-- 同時編集制御
CREATE INDEX idx_edit_locks_target ON "EditLock"("targetType", "targetId");
CREATE INDEX idx_edit_locks_expires ON "EditLock"("expiresAt");

-- 全文検索用（PostgreSQL）
CREATE INDEX idx_test_suites_search ON "TestSuite" USING gin(to_tsvector('simple', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_test_cases_search ON "TestCase" USING gin(to_tsvector('simple', title || ' ' || COALESCE(description, '')));
```

## マイグレーション

```bash
# マイグレーション作成
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name <name>

# マイグレーション適用（本番）
docker compose exec api pnpm --filter @agentest/db prisma migrate deploy
```

## 関連ドキュメント

- [認証関連テーブル](./auth.md)
- [組織・プロジェクト](./organization.md)
- [テストスイート](./test-suite.md)
- [テストケース](./test-case.md)
- [テスト実行](./execution.md)
- [レビュー](./review.md)
- [同時編集制御](./edit-lock.md)
- [システム全体像](../overview.md)
- [API 設計方針](../api-design.md)
