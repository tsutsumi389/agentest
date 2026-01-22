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
| `Session` | ユーザーセッション | [auth.md](./auth.md#session) |

### OAuth 2.1（MCP クライアント向け）

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `OAuthClient` | 動的登録クライアント | [oauth.md](./oauth.md#oauthclient) |
| `OAuthAuthorizationCode` | 認可コード | [oauth.md](./oauth.md#oauthauthorizationcode) |
| `OAuthAccessToken` | アクセストークン | [oauth.md](./oauth.md#oauthaccesstoken) |

### 組織・プロジェクト

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `Organization` | 組織（チーム） | [organization.md](./organization.md#organization) |
| `OrganizationMember` | 組織メンバー（多対多） | [organization.md](./organization.md#organizationmember) |
| `OrganizationInvitation` | 組織への招待 | [organization.md](./organization.md#organizationinvitation) |
| `Project` | プロジェクト | [organization.md](./organization.md#project) |
| `ProjectMember` | プロジェクトメンバー（多対多） | [organization.md](./organization.md#projectmember) |
| `ProjectHistory` | プロジェクトの変更履歴 | [organization.md](./organization.md#projecthistory) |

### 課金・サブスクリプション

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `Subscription` | サブスクリプション情報 | [billing.md](./billing.md#subscription) |
| `Invoice` | 請求書 | [billing.md](./billing.md#invoice) |
| `PaymentMethod` | 支払い方法 | [billing.md](./billing.md#paymentmethod) |

### API トークン

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `ApiToken` | API トークン | [api-token.md](./api-token.md#apitoken) |

### 通知

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `Notification` | 通知 | [notification.md](./notification.md#notification) |
| `NotificationPreference` | 通知設定 | [notification.md](./notification.md#notificationpreference) |
| `OrganizationNotificationSetting` | 組織通知設定 | [notification.md](./notification.md#organizationnotificationsetting) |

### 監査ログ

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `AuditLog` | 監査ログ | [audit-log.md](./audit-log.md#auditlog) |

### 管理者認証関連

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `AdminUser` | 管理者ユーザー | [admin-auth.md](./admin-auth.md#adminuser) |
| `AdminSession` | 管理者セッション | [admin-auth.md](./admin-auth.md#adminsession) |
| `AdminAuditLog` | 管理者監査ログ | [admin-auth.md](./admin-auth.md#adminauditlog) |

### 使用量記録

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `UsageRecord` | 月次使用量記録 | [usage.md](./usage.md#usagerecord) |

### Agent セッション

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `AgentSession` | Coding Agent のセッション管理 | [agent-session.md](./agent-session.md#agentsession) |

### テストスイート

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `TestSuite` | テストスイート（テストケースのグループ） | [test-suite.md](./test-suite.md#testsuite) |
| `TestSuitePrecondition` | テストスイートの前提条件 | [test-suite.md](./test-suite.md#testsuiteprecondition) |
| `TestSuiteHistory` | テストスイートの変更履歴 | [test-suite.md](./test-suite.md#testsuitehistory) |

### ラベル

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `Label` | ラベル（プロジェクト単位） | [label.md](./label.md#label) |
| `TestSuiteLabel` | テストスイート-ラベル中間テーブル | [label.md](./label.md#testsuitelabel) |

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
| `ExecutionTestSuite` | 実行時のテストスイートスナップショット | [execution.md](./execution.md#executiontestsuite) |
| `ExecutionTestSuitePrecondition` | 実行時のスイート前提条件スナップショット | [execution.md](./execution.md#executiontestsuiteprecondition) |
| `ExecutionTestCase` | 実行時のテストケーススナップショット | [execution.md](./execution.md#executiontestcase) |
| `ExecutionTestCasePrecondition` | 実行時のケース前提条件スナップショット | [execution.md](./execution.md#executiontestcaseprecondition) |
| `ExecutionTestCaseStep` | 実行時の手順スナップショット | [execution.md](./execution.md#executiontestcasestep) |
| `ExecutionTestCaseExpectedResult` | 実行時の期待結果スナップショット | [execution.md](./execution.md#executiontestcaseexpectedresult) |
| `ExecutionPreconditionResult` | 前提条件の確認結果 | [execution.md](./execution.md#executionpreconditionresult) |
| `ExecutionStepResult` | 手順の実施結果 | [execution.md](./execution.md#executionstepresult) |
| `ExecutionExpectedResult` | 期待値の判定結果 | [execution.md](./execution.md#executionexpectedresult) |
| `ExecutionEvidence` | エビデンス（添付ファイル） | [execution.md](./execution.md#executionevidence) |

### レビュー

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `ReviewComment` | レビューコメント（詳細項目対応） | [review.md](./review.md#reviewcomment) |
| `ReviewCommentReply` | レビューコメントへの返信 | [review.md](./review.md#reviewcommentreply) |

### 同時編集制御

| テーブル | 説明 | 詳細 |
|---------|------|------|
| `EditLock` | 編集ロック管理 | [edit-lock.md](./edit-lock.md#editlock) |

## 設計方針

### User/Agent 識別パターン

User と Agent の操作を区別するため、以下のパターンを採用：

```prisma
// User の場合
createdByUserId         String?  @db.Uuid

// Agent の場合
createdByAgentSessionId String?  @db.Uuid
```

- どちらか一方のみ設定される排他制約
- AgentSession テーブルで Agent のセッションを管理
- MCP ヘッダー（`X-MCP-Session-Id`）でセッションを識別

### 順序管理（Fractional Indexing）

`orderKey` カラムで順序を管理。間への挿入時に後続要素の更新が不要。

```
初期: A="a", B="b", C="c"
AとBの間に挿入: A="a", X="aV", B="b", C="c"
```

### 正規化テーブルによるスナップショット

テスト実行時に正規化テーブル群へスナップショットを作成し、各結果テーブルからスナップショットテーブルを参照：

```prisma
// スナップショットテーブル
model ExecutionTestCaseStep {
  id                  String   @id @default(uuid())
  executionTestCaseId String   // 実行テストケースへの参照
  originalStepId      String   // 元の手順 ID
  content             String   // スナップショットされた内容
  orderKey            String
}

// 結果テーブル
model ExecutionStepResult {
  executionStepId     String   // スナップショットテーブルへの参照
  // ...
}
```

## ENUM 値一覧

Coding Agent が理解しやすい英語の文字列を使用。

### ステータス系

| ENUM | 値 | 説明 |
|------|-----|------|
| `EntityStatus` | DRAFT, ACTIVE, ARCHIVED | スイート/ケース共通のステータス |
| `TestCasePriority` | CRITICAL, HIGH, MEDIUM, LOW | 優先度 |
| `PreconditionStatus` | UNCHECKED, MET, NOT_MET | 前提条件の確認状態 |
| `StepStatus` | PENDING, DONE, SKIPPED | 手順の実施状態 |
| `JudgmentStatus` | PENDING, PASS, FAIL, SKIPPED | 期待値の判定結果 |
| `ReviewStatus` | OPEN, RESOLVED | レビューコメントのステータス |
| `AgentSessionStatus` | ACTIVE, IDLE, ENDED, TIMEOUT | Agent セッションのステータス |
| `SubscriptionStatus` | ACTIVE, PAST_DUE, CANCELED, TRIALING | サブスクリプションステータス |
| `InvoiceStatus` | PENDING, PAID, FAILED, VOID | 請求書ステータス |

### 種別系

| ENUM | 値 | 説明 |
|------|-----|------|
| `ChangeType` | CREATE, UPDATE, DELETE | 変更種別 |
| `ReviewTargetType` | SUITE, CASE | レビュー対象種別 |
| `ReviewTargetField` | TITLE, DESCRIPTION, PRECONDITION, STEP, EXPECTED_RESULT | レビュー対象フィールド |
| `LockTargetType` | SUITE, CASE | ロック対象種別 |
| `OrganizationRole` | OWNER, ADMIN, MEMBER | 組織内の権限 |
| `ProjectRole` | ADMIN, WRITE, READ | プロジェクト内の権限 |
| `BillingCycle` | MONTHLY, YEARLY | 請求サイクル |
| `PaymentMethodType` | CARD | 支払い方法タイプ |
| `NotificationType` | ORG_INVITATION, INVITATION_ACCEPTED, PROJECT_ADDED, REVIEW_COMMENT, TEST_COMPLETED, TEST_FAILED, USAGE_ALERT, BILLING, SECURITY_ALERT | 通知種別 |
| `AuditLogCategory` | AUTH, USER, ORGANIZATION, MEMBER, PROJECT, API_TOKEN, BILLING | 監査ログカテゴリ |
| `AdminRoleType` | SUPER_ADMIN, ADMIN, VIEWER | 管理者ロール |

### プラン系

| ENUM | 値 | 説明 |
|------|-----|------|
| `UserPlan` | FREE, PRO | 個人プラン |
| `OrganizationPlan` | TEAM, ENTERPRISE | 組織プラン |
| `SubscriptionPlan` | FREE, PRO, TEAM, ENTERPRISE | サブスクリプションプラン |

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

-- Agent セッション
CREATE INDEX idx_agent_sessions_project_id ON "AgentSession"("projectId");
CREATE INDEX idx_agent_sessions_status ON "AgentSession"("status");
CREATE INDEX idx_agent_sessions_heartbeat ON "AgentSession"("lastHeartbeat");

-- テストスイート
CREATE INDEX idx_test_suites_project_id ON "TestSuite"("projectId");
CREATE INDEX idx_suite_preconditions_suite_id ON "TestSuitePrecondition"("testSuiteId");
CREATE INDEX idx_suite_preconditions_order ON "TestSuitePrecondition"("testSuiteId", "orderKey");
CREATE INDEX idx_suite_history_suite_id ON "TestSuiteHistory"("testSuiteId");

-- ラベル
CREATE INDEX idx_labels_project_id ON "labels"("project_id");
CREATE UNIQUE INDEX idx_labels_project_name ON "labels"("project_id", "name");
CREATE INDEX idx_test_suite_labels_test_suite_id ON "test_suite_labels"("test_suite_id");
CREATE INDEX idx_test_suite_labels_label_id ON "test_suite_labels"("label_id");

-- テストケース
CREATE INDEX idx_test_cases_suite_id ON "TestCase"("testSuiteId");
CREATE INDEX idx_test_cases_order ON "TestCase"("testSuiteId", "orderKey");
CREATE INDEX idx_case_preconditions_case_id ON "TestCasePrecondition"("testCaseId");
CREATE INDEX idx_case_steps_case_id ON "TestCaseStep"("testCaseId");
CREATE INDEX idx_case_expected_case_id ON "TestCaseExpectedResult"("testCaseId");
CREATE INDEX idx_case_history_case_id ON "TestCaseHistory"("testCaseId");

-- テスト実行
CREATE INDEX idx_executions_suite_id ON "executions"("test_suite_id");

-- 実行時スナップショット（正規化テーブル）
CREATE INDEX idx_exec_suite_precond_suite_id ON "execution_test_suite_preconditions"("execution_test_suite_id");
CREATE INDEX idx_exec_suite_precond_order ON "execution_test_suite_preconditions"("execution_test_suite_id", "order_key");
CREATE INDEX idx_exec_test_case_suite_id ON "execution_test_cases"("execution_test_suite_id");
CREATE INDEX idx_exec_test_case_order ON "execution_test_cases"("execution_test_suite_id", "order_key");
CREATE INDEX idx_exec_case_precond_case_id ON "execution_test_case_preconditions"("execution_test_case_id");
CREATE INDEX idx_exec_case_precond_order ON "execution_test_case_preconditions"("execution_test_case_id", "order_key");
CREATE INDEX idx_exec_case_step_case_id ON "execution_test_case_steps"("execution_test_case_id");
CREATE INDEX idx_exec_case_step_order ON "execution_test_case_steps"("execution_test_case_id", "order_key");
CREATE INDEX idx_exec_case_expected_case_id ON "execution_test_case_expected_results"("execution_test_case_id");
CREATE INDEX idx_exec_case_expected_order ON "execution_test_case_expected_results"("execution_test_case_id", "order_key");

-- 実行結果
CREATE INDEX idx_exec_precond_execution_id ON "execution_precondition_results"("execution_id");
CREATE INDEX idx_exec_step_execution_id ON "execution_step_results"("execution_id");
CREATE INDEX idx_exec_expected_execution_id ON "execution_expected_results"("execution_id");
CREATE INDEX idx_exec_evidence_expected_id ON "execution_evidences"("expected_result_id");

-- レビュー
CREATE INDEX idx_review_comments_target ON "ReviewComment"("targetType", "targetId");
CREATE INDEX idx_review_comments_item ON "ReviewComment"("targetType", "targetId", "targetField", "targetItemId");
CREATE INDEX idx_review_replies_comment_id ON "ReviewCommentReply"("commentId");

-- 同時編集制御
CREATE INDEX idx_edit_locks_target ON "EditLock"("targetType", "targetId");
CREATE INDEX idx_edit_locks_expires ON "EditLock"("expiresAt");

-- セッション
CREATE INDEX idx_sessions_user_id ON "Session"("userId");
CREATE INDEX idx_sessions_token ON "Session"("token");
CREATE INDEX idx_sessions_expires ON "Session"("expiresAt");

-- 組織招待
CREATE INDEX idx_org_invitations_org_id ON "OrganizationInvitation"("organizationId");
CREATE INDEX idx_org_invitations_token ON "OrganizationInvitation"("token");
CREATE INDEX idx_org_invitations_email ON "OrganizationInvitation"("email");

-- プロジェクトメンバー
CREATE INDEX idx_project_members_project_id ON "ProjectMember"("projectId");
CREATE INDEX idx_project_members_user_id ON "ProjectMember"("userId");

-- 課金・サブスクリプション
CREATE INDEX idx_subscriptions_user_id ON "Subscription"("userId");
CREATE INDEX idx_subscriptions_org_id ON "Subscription"("organizationId");
CREATE INDEX idx_subscriptions_status ON "Subscription"("status");
CREATE INDEX idx_invoices_subscription_id ON "Invoice"("subscriptionId");
CREATE INDEX idx_invoices_status ON "Invoice"("status");
CREATE INDEX idx_payment_methods_user_id ON "PaymentMethod"("userId");
CREATE INDEX idx_payment_methods_org_id ON "PaymentMethod"("organizationId");

-- API トークン
CREATE INDEX idx_api_tokens_user_id ON "ApiToken"("userId");
CREATE INDEX idx_api_tokens_org_id ON "ApiToken"("organizationId");
CREATE INDEX idx_api_tokens_hash ON "ApiToken"("tokenHash");

-- 通知
CREATE INDEX idx_notifications_user_id ON "Notification"("userId");
CREATE INDEX idx_notifications_user_read ON "Notification"("userId", "readAt");
CREATE INDEX idx_notifications_created ON "Notification"("createdAt");
CREATE INDEX idx_notification_prefs_user_id ON "NotificationPreference"("userId");
CREATE INDEX idx_org_notification_settings_org_id ON "OrganizationNotificationSetting"("organizationId");

-- 監査ログ
CREATE INDEX idx_audit_logs_org_id ON "AuditLog"("organizationId");
CREATE INDEX idx_audit_logs_user_id ON "AuditLog"("userId");
CREATE INDEX idx_audit_logs_category ON "AuditLog"("category");
CREATE INDEX idx_audit_logs_created ON "AuditLog"("createdAt");
CREATE INDEX idx_audit_logs_org_created ON "AuditLog"("organizationId", "createdAt");

-- 管理者認証
CREATE UNIQUE INDEX idx_admin_users_email ON "admin_users"("email");
CREATE INDEX idx_admin_users_deleted ON "admin_users"("deleted_at");
CREATE INDEX idx_admin_sessions_user_id ON "admin_sessions"("admin_user_id");
CREATE UNIQUE INDEX idx_admin_sessions_token ON "admin_sessions"("token");
CREATE INDEX idx_admin_sessions_expires ON "admin_sessions"("expires_at");
CREATE INDEX idx_admin_audit_logs_user_id ON "admin_audit_logs"("admin_user_id");
CREATE INDEX idx_admin_audit_logs_action ON "admin_audit_logs"("action");
CREATE INDEX idx_admin_audit_logs_created ON "admin_audit_logs"("created_at");

-- 使用量記録
CREATE INDEX idx_usage_records_user_id ON "UsageRecord"("userId");
CREATE INDEX idx_usage_records_org_id ON "UsageRecord"("organizationId");
CREATE INDEX idx_usage_records_period ON "UsageRecord"("periodStart");

-- 全文検索用（pg_bigm: 日本語対応）
-- 拡張の有効化（マイグレーション時に1回実行）
CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- テストスイート検索用
CREATE INDEX idx_test_suites_name_search ON "TestSuite" USING gin(name gin_bigm_ops);
CREATE INDEX idx_test_suites_desc_search ON "TestSuite" USING gin(description gin_bigm_ops) WHERE description IS NOT NULL;

-- テストケース検索用
CREATE INDEX idx_test_cases_title_search ON "TestCase" USING gin(title gin_bigm_ops);
CREATE INDEX idx_test_cases_desc_search ON "TestCase" USING gin(description gin_bigm_ops) WHERE description IS NOT NULL;
```

### 検索クエリ例

```sql
-- LIKE 検索（pg_bigm でインデックスが効く）
SELECT * FROM "TestSuite" WHERE name LIKE '%ログイン%';

-- OR 検索
SELECT * FROM "TestCase" WHERE title LIKE '%認証%' OR description LIKE '%認証%';
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
- [OAuth 2.1（MCP クライアント向け）](./oauth.md)
- [組織・プロジェクト](./organization.md)
- [Agent セッション](./agent-session.md)
- [テストスイート](./test-suite.md)
- [ラベル](./label.md)
- [テストケース](./test-case.md)
- [テスト実行](./execution.md)
- [レビュー](./review.md)
- [同時編集制御](./edit-lock.md)
- [課金・サブスクリプション](./billing.md)
- [API トークン](./api-token.md)
- [通知](./notification.md)
- [監査ログ](./audit-log.md)
- [使用量記録](./usage.md)
- [管理者認証](./admin-auth.md)
- [システム全体像](../overview.md)
- [API 設計方針](../api-design.md)
- [ユーザー・オーガナイゼーション機能](../../requirements/user-organization.md)
