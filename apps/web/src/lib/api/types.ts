// ============================================
// API型定義
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  totpEnabled: boolean;
}

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  // 組織一覧取得時にメンバー数が含まれる
  _count?: {
    members: number;
  };
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

// 招待詳細取得用の型（トークンベース）
export interface InvitationDetail {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  expiresAt: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  organization: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  invitedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface AuditLog {
  id: string;
  organizationId: string | null;
  userId: string | null;
  category: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: { id: string; name: string } | null;
  _count?: { testSuites: number };
}

/** プロジェクトメンバーのロール */
export type ProjectMemberRole = 'ADMIN' | 'WRITE' | 'READ';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'OWNER' | ProjectMemberRole;
  addedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  _count?: { testCases: number; preconditions: number };
  // テストスイート一覧で取得される追加フィールド
  labels?: Array<{ id: string; name: string; color: string }>;
  lastExecution?: {
    id: string;
    createdAt: string;
    environment: { id: string; name: string } | null;
    judgmentCounts: {
      PASS: number;
      FAIL: number;
      PENDING: number;
      SKIPPED: number;
    };
  } | null;
}

/** テストスイート前提条件 */
export interface Precondition {
  id: string;
  testSuiteId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/** テストスイート変更タイプ */
export type TestSuiteChangeType = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

/** テストスイート履歴 */
export interface TestSuiteHistory {
  id: string;
  testSuiteId: string;
  changeType: TestSuiteChangeType;
  snapshot: Record<string, unknown>;
  changeReason: string | null;
  groupId: string | null;
  createdAt: string;
  changedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

/**
 * テストスイートのカテゴリ別履歴（APIレスポンス用）
 */
export interface TestSuiteCategorizedHistories {
  basicInfo: TestSuiteHistory[];
  preconditions: TestSuiteHistory[];
}

/**
 * グループ化されたテストスイート履歴アイテム（APIレスポンス用）
 * groupIdがnullの場合は単一履歴を含むグループ
 * @agentest/sharedではcreatedAt: Dateだが、APIレスポンスのJSONシリアライズによりstring型として受け取る
 */
export interface TestSuiteHistoryGroupedItem {
  groupId: string | null;
  categorizedHistories: TestSuiteCategorizedHistories;
  createdAt: string;
}

/**
 * テストスイート履歴一覧レスポンス（グループ化版）
 */
export interface TestSuiteHistoriesGroupedResponse {
  items: TestSuiteHistoryGroupedItem[];
  totalGroups: number;
  total: number;
}

/** テストスイート検索パラメータ */
export interface TestSuiteSearchParams {
  q?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  // ラベルフィルター（OR条件）
  labelIds?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

/** 実行履歴検索パラメータ */
export interface ExecutionSearchParams {
  from?: string;
  to?: string;
  /** UUID または 'none'（環境未設定でフィルタ） */
  environmentId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/** 実行履歴検索レスポンス */
export interface ExecutionSearchResponse {
  executions: Execution[];
  total: number;
  limit: number;
  offset: number;
}

/** テストスイートサジェスト結果 */
export interface TestSuiteSuggestion {
  id: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

/** テストケースサジェスト結果 */
export interface TestCaseSuggestion {
  id: string;
  title: string;
  description: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

/** プロジェクト履歴の変更タイプ */
export type ProjectChangeType = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

/** プロジェクト履歴 */
export interface ProjectHistory {
  id: string;
  projectId: string;
  changeType: ProjectChangeType;
  snapshot: Record<string, unknown>;
  changeReason: string | null;
  createdAt: string;
  changedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

/** プロジェクト環境 */
export interface ProjectEnvironment {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string | null;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 環境作成リクエスト */
export interface CreateEnvironmentRequest {
  name: string;
  baseUrl?: string | null;
  description?: string | null;
  isDefault?: boolean;
}

/** 環境更新リクエスト */
export interface UpdateEnvironmentRequest {
  name?: string;
  baseUrl?: string | null;
  description?: string | null;
  isDefault?: boolean;
}

export interface TestCase {
  id: string;
  testSuiteId: string;
  title: string;
  description: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  orderKey: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** テストケース前提条件 */
export interface TestCasePrecondition {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/** テストケースステップ */
export interface TestCaseStep {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/** テストケース期待結果 */
export interface TestCaseExpectedResult {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/** テストケース変更タイプ */
export type TestCaseChangeType = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';

/** テストケース履歴 */
export interface TestCaseHistory {
  id: string;
  testCaseId: string;
  changeType: TestCaseChangeType;
  snapshot: Record<string, unknown>;
  changeReason: string | null;
  groupId: string | null;
  createdAt: string;
  changedBy: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

/**
 * カテゴリ別履歴（APIレスポンス用）
 */
export interface CategorizedHistories {
  basicInfo: TestCaseHistory[];
  preconditions: TestCaseHistory[];
  steps: TestCaseHistory[];
  expectedResults: TestCaseHistory[];
}

/**
 * グループ化された履歴アイテム（APIレスポンス用）
 * groupIdがnullの場合は単一履歴を含むグループ
 * @agentest/sharedではcreatedAt: Dateだが、APIレスポンスのJSONシリアライズによりstring型として受け取る
 */
export interface TestCaseHistoryGroupedItem {
  groupId: string | null;
  categorizedHistories: CategorizedHistories;
  createdAt: string;
}

/**
 * 履歴一覧レスポンス（グループ化版）
 */
export interface TestCaseHistoriesGroupedResponse {
  items: TestCaseHistoryGroupedItem[];
  totalGroups: number;
  total: number;
}

/** テストケース詳細（前提条件・ステップ・期待結果含む） */
export interface TestCaseWithDetails extends TestCase {
  preconditions: TestCasePrecondition[];
  steps: TestCaseStep[];
  expectedResults: TestCaseExpectedResult[];
}

export interface Execution {
  id: string;
  testSuiteId: string;
  environmentId: string | null;
  createdAt: string;
  executedByUser?: { id: string; name: string; avatarUrl: string | null };
  environment?: { id: string; name: string };
  judgmentCounts?: {
    PASS: number;
    FAIL: number;
    PENDING: number;
    SKIPPED: number;
  };
}

/** 実行時テストスイート事前条件 */
export interface ExecutionTestSuitePrecondition {
  id: string;
  executionTestSuiteId: string;
  originalPreconditionId: string;
  content: string;
  orderKey: string;
  createdAt: string;
}

/** 実行時テストケース事前条件 */
export interface ExecutionTestCasePrecondition {
  id: string;
  executionTestCaseId: string;
  originalPreconditionId: string;
  content: string;
  orderKey: string;
  createdAt: string;
}

/** 実行時テストケースステップ */
export interface ExecutionTestCaseStepSnapshot {
  id: string;
  executionTestCaseId: string;
  originalStepId: string;
  content: string;
  orderKey: string;
  createdAt: string;
}

/** 実行時テストケース期待結果 */
export interface ExecutionTestCaseExpectedResultSnapshot {
  id: string;
  executionTestCaseId: string;
  originalExpectedResultId: string;
  content: string;
  orderKey: string;
  createdAt: string;
}

/** 実行時テストケース（詳細含む） */
export interface ExecutionTestCaseSnapshot {
  id: string;
  executionTestSuiteId: string;
  originalTestCaseId: string;
  title: string;
  description: string | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  orderKey: string;
  createdAt: string;
  preconditions: ExecutionTestCasePrecondition[];
  steps: ExecutionTestCaseStepSnapshot[];
  expectedResults: ExecutionTestCaseExpectedResultSnapshot[];
}

/** 実行時テストスイート（正規化テーブル） */
export interface ExecutionTestSuite {
  id: string;
  executionId: string;
  originalTestSuiteId: string;
  name: string;
  description: string | null;
  createdAt: string;
  preconditions: ExecutionTestSuitePrecondition[];
  testCases: ExecutionTestCaseSnapshot[];
}

/** 前提条件結果 */
export interface ExecutionPreconditionResult {
  id: string;
  executionId: string;
  executionTestCaseId: string | null;
  executionSuitePreconditionId: string | null;
  executionCasePreconditionId: string | null;
  status: 'UNCHECKED' | 'MET' | 'NOT_MET';
  checkedAt: string | null;
  note: string | null;
  // 実施者情報
  checkedByUser?: { id: string; name: string; avatarUrl: string | null } | null;
  checkedByAgentName?: string | null;
  suitePrecondition?: ExecutionTestSuitePrecondition | null;
  casePrecondition?: ExecutionTestCasePrecondition | null;
  executionTestCase?: { id: string; title: string } | null;
}

/** ステップ結果 */
export interface ExecutionStepResult {
  id: string;
  executionId: string;
  executionTestCaseId: string;
  executionStepId: string;
  status: 'PENDING' | 'DONE' | 'SKIPPED';
  executedAt: string | null;
  note: string | null;
  // 実施者情報
  executedByUser?: { id: string; name: string; avatarUrl: string | null } | null;
  executedByAgentName?: string | null;
  executionStep?: ExecutionTestCaseStepSnapshot;
  executionTestCase?: { id: string; title: string };
}

/** エビデンス */
export interface ExecutionEvidence {
  id: string;
  expectedResultId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: string; // BigIntはstringとして受け取る
  description: string | null;
  downloadUrl: string | null;
  createdAt: string;
}

/** 期待結果 */
export interface ExecutionExpectedResult {
  id: string;
  executionId: string;
  executionTestCaseId: string;
  executionExpectedResultId: string;
  status: 'PENDING' | 'PASS' | 'FAIL' | 'SKIPPED';
  judgedAt: string | null;
  note: string | null;
  // 実施者情報
  judgedByUser?: { id: string; name: string; avatarUrl: string | null } | null;
  judgedByAgentName?: string | null;
  evidences: ExecutionEvidence[];
  executionExpectedResult?: ExecutionTestCaseExpectedResultSnapshot;
  executionTestCase?: { id: string; title: string };
}

/** 詳細付き実行 */
export interface ExecutionWithDetails extends Execution {
  testSuite: { id: string; name: string; projectId: string };
  executionTestSuite: ExecutionTestSuite | null;
  preconditionResults: ExecutionPreconditionResult[];
  stepResults: ExecutionStepResult[];
  expectedResults: ExecutionExpectedResult[];
}

/** ログインレスポンス: 2FA不要の場合はuser、2FA必要の場合はtwoFactorToken */
export type LoginResponse =
  | { user: User; requires2FA?: undefined }
  | { requires2FA: true; twoFactorToken: string; user?: undefined };

/** 2FAセットアップレスポンス */
export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

export interface UpdateUserRequest {
  name?: string;
  avatarUrl?: string | null;
}

/** プロジェクト検索オプション */
export interface GetProjectsOptions {
  q?: string;
  organizationId?: string | null;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

/** 拡張プロジェクト型（削除日時とロールを含む） */
export interface ProjectWithRole extends Project {
  deletedAt?: string | null;
  role?: 'OWNER' | 'ADMIN' | 'WRITE' | 'READ';
}

// ユーザーダッシュボード関連の型を再エクスポート
export type { RecentExecutionItem } from '@agentest/shared';

/** 前提条件結果ステータス */
export type PreconditionResultStatus = 'UNCHECKED' | 'MET' | 'NOT_MET';

/** ステップ結果ステータス */
export type StepResultStatus = 'PENDING' | 'DONE' | 'SKIPPED';

/** 期待結果ステータス */
export type ExpectedResultStatus = 'PENDING' | 'PASS' | 'FAIL' | 'SKIPPED';

/** 前提条件結果更新リクエスト */
export interface UpdatePreconditionResultRequest {
  status: PreconditionResultStatus;
  note?: string;
}

/** ステップ結果更新リクエスト */
export interface UpdateStepResultRequest {
  status: StepResultStatus;
  note?: string;
}

/** 期待結果更新リクエスト */
export interface UpdateExpectedResultRequest {
  status: ExpectedResultStatus;
  note?: string;
}

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface RevokeSessionsResult {
  success: boolean;
  revokedCount: number;
}

export interface Account {
  id: string;
  provider: 'github' | 'google';
  providerAccountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
  description?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface AuditLogQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export type AuditLogExportFormat = 'csv' | 'json';

export interface AuditLogExportParams {
  format: AuditLogExportFormat;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// レビュー関連型定義（@agentest/sharedから再エクスポート）
export type {
  ReviewTargetType,
  ReviewTargetField,
  ReviewStatus,
  ReviewSessionStatus,
  ReviewVerdict,
} from '@agentest/shared';

export type {
  Review,
  ReviewAuthor,
  ReviewAgentSession,
  ReviewWithAuthor,
  ReviewWithDetails,
  DraftReview,
  ReviewComment,
  ReviewCommentWithReplies,
  ReviewReply,
  ReviewCommentListResponse,
  ReviewListResponse,
  ProjectDashboardStats,
} from '@agentest/shared';

// ファイル内で使用するためにインポート
import type { ReviewTargetType, ReviewTargetField, ReviewVerdict } from '@agentest/shared';

/** コメント作成リクエスト */
export interface CreateReviewCommentRequest {
  targetType: ReviewTargetType;
  targetId: string;
  targetField: ReviewTargetField;
  targetItemId?: string;
  targetItemContent?: string;
  content: string;
}

/** コメント検索パラメータ */
export interface ReviewCommentSearchParams {
  status?: 'OPEN' | 'RESOLVED' | 'ALL';
  targetField?: ReviewTargetField;
  limit?: number;
  offset?: number;
}

/** レビュー検索パラメータ */
export interface ReviewSearchParams {
  verdict?: ReviewVerdict;
  limit?: number;
  offset?: number;
}

/** APIトークン */
export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** 新規作成されたAPIトークン（生トークン含む） */
export interface CreatedApiToken extends ApiToken {
  rawToken: string;
}

/** APIトークン作成リクエスト */
export interface CreateApiTokenRequest {
  name: string;
  expiresInDays?: number;
}

/** ラベル */
export interface Label {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/** ラベル作成リクエスト */
export interface CreateLabelRequest {
  name: string;
  description?: string | null;
  color: string;
}

/** ラベル更新リクエスト */
export interface UpdateLabelRequest {
  name?: string;
  description?: string | null;
  color?: string;
}

export type AgentSessionStatus = 'ACTIVE' | 'IDLE' | 'ENDED' | 'TIMEOUT';
export type SessionSource = 'agent' | 'oauth';

export interface AgentSessionItem {
  id: string;
  source: SessionSource;
  projectId: string | null;
  projectName: string | null;
  clientId: string;
  clientName: string | null;
  status: AgentSessionStatus;
  startedAt: string;
  lastHeartbeat: string;
  endedAt: string | null;
}

export interface AgentSessionListResponse {
  data: AgentSessionItem[];
  meta: { total: number; page: number; limit: number };
}

/** 通知タイプ */
export type NotificationType =
  | 'ORG_INVITATION'
  | 'INVITATION_ACCEPTED'
  | 'PROJECT_ADDED'
  | 'REVIEW_COMMENT'
  | 'TEST_COMPLETED'
  | 'TEST_FAILED';

/** 通知 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

/** 通知設定 */
export interface NotificationPreference {
  type: NotificationType;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

/** 通知一覧取得パラメータ */
export interface GetNotificationsParams {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

/** アプリケーション公開設定 */
export interface AppConfig {
  auth: {
    providers: {
      github: boolean;
      google: boolean;
    };
    requireEmailVerification: boolean;
  };
}
