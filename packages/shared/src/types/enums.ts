// ロール
export const OrganizationRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type OrganizationRole = (typeof OrganizationRole)[keyof typeof OrganizationRole];

export const ProjectRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  WRITE: 'WRITE',
  READ: 'READ',
} as const;
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

// エンティティステータス
export const EntityStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type EntityStatus = (typeof EntityStatus)[keyof typeof EntityStatus];

// テストケース優先度
export const TestCasePriority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type TestCasePriority = (typeof TestCasePriority)[keyof typeof TestCasePriority];

// 実行結果ステータス
export const PreconditionStatus = {
  UNCHECKED: 'UNCHECKED',
  MET: 'MET',
  NOT_MET: 'NOT_MET',
} as const;
export type PreconditionStatus = (typeof PreconditionStatus)[keyof typeof PreconditionStatus];

export const StepStatus = {
  PENDING: 'PENDING',
  DONE: 'DONE',
  SKIPPED: 'SKIPPED',
} as const;
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

export const JudgmentStatus = {
  PENDING: 'PENDING',
  PASS: 'PASS',
  FAIL: 'FAIL',
  SKIPPED: 'SKIPPED',
} as const;
export type JudgmentStatus = (typeof JudgmentStatus)[keyof typeof JudgmentStatus];

// レビュー & 編集ロック
export const ReviewStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

// レビューセッションステータス
export const ReviewSessionStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
} as const;
export type ReviewSessionStatus = (typeof ReviewSessionStatus)[keyof typeof ReviewSessionStatus];

// レビュー評価
export const ReviewVerdict = {
  APPROVED: 'APPROVED',
  CHANGES_REQUESTED: 'CHANGES_REQUESTED',
  COMMENT_ONLY: 'COMMENT_ONLY',
} as const;
export type ReviewVerdict = (typeof ReviewVerdict)[keyof typeof ReviewVerdict];

export const ReviewTargetType = {
  SUITE: 'SUITE',
  CASE: 'CASE',
} as const;
export type ReviewTargetType = (typeof ReviewTargetType)[keyof typeof ReviewTargetType];

export const ReviewTargetField = {
  TITLE: 'TITLE',
  DESCRIPTION: 'DESCRIPTION',
  PRECONDITION: 'PRECONDITION',
  STEP: 'STEP',
  EXPECTED_RESULT: 'EXPECTED_RESULT',
} as const;
export type ReviewTargetField = (typeof ReviewTargetField)[keyof typeof ReviewTargetField];

export const LockTargetType = {
  SUITE: 'SUITE',
  CASE: 'CASE',
} as const;
export type LockTargetType = (typeof LockTargetType)[keyof typeof LockTargetType];

// エージェントセッション
export const AgentSessionStatus = {
  ACTIVE: 'ACTIVE',
  IDLE: 'IDLE',
  ENDED: 'ENDED',
  TIMEOUT: 'TIMEOUT',
} as const;
export type AgentSessionStatus = (typeof AgentSessionStatus)[keyof typeof AgentSessionStatus];

// 履歴 & 監査
export const ChangeType = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
} as const;
export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

export const NotificationType = {
  ORG_INVITATION: 'ORG_INVITATION',
  INVITATION_ACCEPTED: 'INVITATION_ACCEPTED',
  PROJECT_ADDED: 'PROJECT_ADDED',
  REVIEW_COMMENT: 'REVIEW_COMMENT',
  TEST_COMPLETED: 'TEST_COMPLETED',
  TEST_FAILED: 'TEST_FAILED',
  SECURITY_ALERT: 'SECURITY_ALERT',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const AuditLogCategory = {
  AUTH: 'AUTH',
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  MEMBER: 'MEMBER',
  PROJECT: 'PROJECT',
  API_TOKEN: 'API_TOKEN',
} as const;
export type AuditLogCategory = (typeof AuditLogCategory)[keyof typeof AuditLogCategory];
