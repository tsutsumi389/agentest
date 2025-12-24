# データベース設計

## 概要

PostgreSQL を使用。Prisma ORM でスキーマ管理。

## ER 図

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     User     │       │ Organization │       │   Project    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id           │──┐    │ id           │──┐    │ id           │
│ email        │  │    │ name         │  │    │ name         │
│ name         │  │    │ slug         │  │    │ description  │
│ avatarUrl    │  │    │ createdAt    │  ├───▶│ organizationId│
│ createdAt    │  │    │ updatedAt    │  │    │ createdAt    │
└──────────────┘  │    └──────────────┘  │    └──────────────┘
                  │                      │           │
                  ▼                      │           ▼
┌─────────────────────┐                  │    ┌──────────────┐
│ OrganizationMember  │                  │    │  TestSuite   │
├─────────────────────┤                  │    ├──────────────┤
│ userId              │◀─────────────────┘    │ id           │
│ organizationId      │                       │ name         │
│ role                │                       │ description  │
│ joinedAt            │                       │ projectId    │
└─────────────────────┘                       │ createdAt    │
                                              └──────────────┘
                                                     │
                                                     ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  TestCase    │       │  Execution   │       │ ExecutionResult│
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id           │◀──────│ testCaseId   │       │ id           │
│ title        │       │ id           │──────▶│ executionId  │
│ description  │       │ status       │       │ status       │
│ steps        │       │ startedAt    │       │ duration     │
│ expectedResult│      │ completedAt  │       │ error        │
│ testSuiteId  │       │ executedBy   │       │ createdAt    │
│ priority     │       └──────────────┘       └──────────────┘
│ createdAt    │
└──────────────┘
```

## 主要テーブル

### 認証関連

| テーブル | 説明 |
|---------|------|
| `User` | ユーザー情報 |
| `Account` | OAuth アカウント（GitHub, Google） |
| `RefreshToken` | JWT リフレッシュトークン |

### 組織・プロジェクト

| テーブル | 説明 |
|---------|------|
| `Organization` | 組織（チーム） |
| `OrganizationMember` | 組織メンバー（多対多） |
| `Project` | プロジェクト |

### テスト管理

| テーブル | 説明 |
|---------|------|
| `TestSuite` | テストスイート（テストケースのグループ） |
| `TestCase` | テストケース |
| `Execution` | テスト実行 |
| `ExecutionResult` | 実行結果 |

## インデックス戦略

```sql
-- 頻繁な検索に対するインデックス
CREATE INDEX idx_test_cases_suite_id ON "TestCase"("testSuiteId");
CREATE INDEX idx_executions_test_case_id ON "Execution"("testCaseId");
CREATE INDEX idx_executions_status ON "Execution"("status");
CREATE INDEX idx_org_members_user_id ON "OrganizationMember"("userId");
```

## マイグレーション

```bash
# マイグレーション作成
docker compose exec dev pnpm --filter @agentest/db prisma migrate dev --name <name>

# マイグレーション適用（本番）
docker compose exec api pnpm --filter @agentest/db prisma migrate deploy
```

## 関連ドキュメント

- [システム全体像](./overview.md)
- [API 設計方針](./api-design.md)
