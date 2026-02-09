import { prisma } from '@agentest/db';
import type { Prisma } from '@agentest/db';
import { randomUUID, createHash } from 'crypto';

/**
 * テスト用トークンハッシュ生成（SHA-256 hex、64文字）
 */
function testHashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * テスト用ユーザーを作成
 */
export async function createTestUser(overrides: Partial<{
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: 'FREE' | 'PRO';
  passwordHash: string | null;
}> = {}) {
  const id = overrides.id ?? randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: overrides.email ?? `test-${id}@example.com`,
      name: overrides.name ?? `Test User ${id.slice(0, 8)}`,
      avatarUrl: overrides.avatarUrl ?? null,
      plan: overrides.plan ?? 'FREE',
      ...(overrides.passwordHash !== undefined && { passwordHash: overrides.passwordHash }),
    },
  });
}

/**
 * テスト用セッションを作成
 */
export async function createTestSession(
  userId: string,
  overrides: Partial<{
    id: string;
    tokenHash: string;
    userAgent: string;
    ipAddress: string;
    expiresAt: Date;
    lastActiveAt: Date;
    revokedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.session.create({
    data: {
      id,
      userId,
      tokenHash: overrides.tokenHash ?? testHashToken(`session-token-${id}`),
      userAgent: overrides.userAgent ?? 'Mozilla/5.0 Test Browser',
      ipAddress: overrides.ipAddress ?? '127.0.0.1',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastActiveAt: overrides.lastActiveAt ?? new Date(),
      revokedAt: overrides.revokedAt ?? null,
    },
  });
}

/**
 * テスト用OAuthアカウントを作成
 */
export async function createTestAccount(
  userId: string,
  overrides: Partial<{
    provider: string;
    providerAccountId: string;
  }> = {}
) {
  return prisma.account.create({
    data: {
      userId,
      provider: overrides.provider ?? 'github',
      providerAccountId: overrides.providerAccountId ?? randomUUID(),
    },
  });
}

/**
 * テスト用組織を作成
 */
export async function createTestOrganization(
  ownerId: string,
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    plan: 'NONE' | 'TEAM' | 'ENTERPRISE';
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  const org = await prisma.organization.create({
    data: {
      id,
      name: overrides.name ?? `Test Org ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
      plan: overrides.plan ?? 'TEAM',
    },
  });

  // オーナーをメンバーとして追加
  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: ownerId,
      role: 'OWNER',
    },
  });

  return org;
}

/**
 * テスト用組織メンバーを作成
 */
export async function createTestOrgMember(
  organizationId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER'
) {
  return prisma.organizationMember.create({
    data: {
      organizationId,
      userId,
      role,
    },
  });
}

/**
 * テスト用組織招待を作成
 */
export async function createTestInvitation(
  organizationId: string,
  invitedByUserId: string,
  overrides: Partial<{
    id: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
    token: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.organizationInvitation.create({
    data: {
      id,
      organizationId,
      email: overrides.email ?? `invited-${id.slice(0, 8)}@example.com`,
      role: overrides.role ?? 'MEMBER',
      token: overrides.token ?? `inv-token-${id}`,
      invitedByUserId,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: overrides.acceptedAt ?? null,
      declinedAt: overrides.declinedAt ?? null,
    },
  });
}

/**
 * テスト用監査ログを作成
 */
export async function createTestAuditLog(
  overrides: Partial<{
    id: string;
    organizationId: string | null;
    userId: string | null;
    category: 'AUTH' | 'USER' | 'ORGANIZATION' | 'MEMBER' | 'PROJECT' | 'API_TOKEN' | 'BILLING';
    action: string;
    targetType: string | null;
    targetId: string | null;
    details: Prisma.InputJsonValue;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.auditLog.create({
    data: {
      id,
      organizationId: overrides.organizationId ?? null,
      userId: overrides.userId ?? null,
      category: overrides.category ?? 'ORGANIZATION',
      action: overrides.action ?? 'test.action',
      targetType: overrides.targetType ?? null,
      targetId: overrides.targetId ?? null,
      details: overrides.details,
      ipAddress: overrides.ipAddress ?? null,
      userAgent: overrides.userAgent ?? null,
      createdAt: overrides.createdAt ?? new Date(),
    },
  });
}

/**
 * テストデータをクリーンアップ
 */
export async function cleanupTestData() {
  // 外部キー制約を考慮した順序で削除
  // メトリクス関連
  await prisma.activeUserMetric.deleteMany({});
  // 管理者関連
  await prisma.adminAuditLog.deleteMany({});
  await prisma.adminSession.deleteMany({});
  await prisma.adminUser.deleteMany({});
  // 課金関連
  await prisma.paymentEvent.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.paymentMethod.deleteMany({});
  // レビュー関連
  await prisma.reviewCommentReply.deleteMany({});
  await prisma.reviewComment.deleteMany({});
  await prisma.auditLog.deleteMany({});
  // 実行結果関連（Executionより前に削除）
  await prisma.executionEvidence.deleteMany({});
  await prisma.executionExpectedResult.deleteMany({});
  await prisma.executionStepResult.deleteMany({});
  await prisma.executionPreconditionResult.deleteMany({});
  // 実行時スナップショット（正規化テーブル）
  await prisma.executionTestCaseExpectedResult.deleteMany({});
  await prisma.executionTestCaseStep.deleteMany({});
  await prisma.executionTestCasePrecondition.deleteMany({});
  await prisma.executionTestCase.deleteMany({});
  await prisma.executionTestSuitePrecondition.deleteMany({});
  await prisma.executionTestSuite.deleteMany({});
  await prisma.execution.deleteMany({});
  await prisma.testSuiteHistory.deleteMany({});
  await prisma.testSuiteLabel.deleteMany({});
  await prisma.label.deleteMany({});
  await prisma.testSuitePrecondition.deleteMany({});
  await prisma.testCaseHistory.deleteMany({});
  await prisma.testCaseExpectedResult.deleteMany({});
  await prisma.testCaseStep.deleteMany({});
  await prisma.testCasePrecondition.deleteMany({});
  await prisma.testCase.deleteMany({});
  await prisma.testSuite.deleteMany({});
  await prisma.projectEnvironment.deleteMany({});
  await prisma.projectHistory.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.organizationInvitation.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.organization.deleteMany({});
  // OAuth関連
  await prisma.oAuthAccessToken.deleteMany({});
  await prisma.oAuthAuthorizationCode.deleteMany({});
  await prisma.oAuthClient.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
}

/**
 * 認証ヘッダーを生成（テスト用のモック認証で使用）
 */
export function createAuthHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * テスト用プロジェクトを作成
 * プロジェクト作成時にオーナーをProjectMemberとしても登録する
 */
export async function createTestProject(
  ownerId: string,
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    organizationId: string | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        id,
        name: overrides.name ?? `Test Project ${id.slice(0, 8)}`,
        description: overrides.description ?? null,
        organizationId: overrides.organizationId ?? null,
      },
    });
    // オーナーをProjectMemberとして登録
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: ownerId,
        role: 'OWNER',
      },
    });
    return project;
  });
}

/**
 * テスト用プロジェクトメンバーを作成
 */
export async function createTestProjectMember(
  projectId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'WRITE' | 'READ' = 'READ'
) {
  return prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role,
    },
  });
}

/**
 * テスト用プロジェクト環境を作成
 */
export async function createTestEnvironment(
  projectId: string,
  overrides: Partial<{
    id: string;
    name: string;
    baseUrl: string | null;
    description: string | null;
    isDefault: boolean;
    sortOrder: number;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.projectEnvironment.create({
    data: {
      id,
      projectId,
      name: overrides.name ?? `Environment ${id.slice(0, 8)}`,
      baseUrl: overrides.baseUrl ?? null,
      description: overrides.description ?? null,
      isDefault: overrides.isDefault ?? false,
      sortOrder: overrides.sortOrder ?? 0,
    },
  });
}

/**
 * テスト用テストスイートを作成
 */
export async function createTestSuite(
  projectId: string,
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    createdAt: Date;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testSuite.create({
    data: {
      id,
      projectId,
      name: overrides.name ?? `Test Suite ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
      status: overrides.status ?? 'DRAFT',
      ...(overrides.createdAt && { createdAt: overrides.createdAt }),
    },
  });
}

/**
 * テスト用実行記録を作成
 */
export async function createTestExecution(
  environmentId: string,
  testSuiteId: string,
  overrides: Partial<{
    id: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.execution.create({
    data: {
      id,
      environmentId,
      testSuiteId,
    },
  });
}

/**
 * テスト用テストスイート履歴を作成
 * changeDetailはsnapshot内に含まれる（BASIC_INFO_UPDATE, PRECONDITION_ADD/UPDATE/DELETE/REORDER, TEST_CASE_REORDER等）
 */
export async function createTestSuiteHistory(
  testSuiteId: string,
  overrides: Partial<{
    id: string;
    changedByUserId: string | null;
    changedByAgentSessionId: string | null;
    changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    snapshot: Prisma.InputJsonValue;
    changeDetail: Prisma.InputJsonValue | null;
    changeReason: string | null;
    groupId: string | null;
    createdAt: Date;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  // changeDetailはsnapshotの中に含める
  const baseSnapshot = overrides.snapshot ?? { name: 'Test Suite' };
  const snapshot = overrides.changeDetail
    ? { ...(baseSnapshot as object), changeDetail: overrides.changeDetail }
    : baseSnapshot;

  return prisma.testSuiteHistory.create({
    data: {
      id,
      testSuiteId,
      changedByUserId: overrides.changedByUserId ?? null,
      changedByAgentSessionId: overrides.changedByAgentSessionId ?? null,
      changeType: overrides.changeType ?? 'CREATE',
      snapshot,
      changeReason: overrides.changeReason ?? null,
      groupId: overrides.groupId ?? null,
      createdAt: overrides.createdAt ?? new Date(),
    },
  });
}

/**
 * テスト用前提条件を作成
 */
export async function createTestPrecondition(
  testSuiteId: string,
  overrides: Partial<{
    id: string;
    content: string;
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testSuitePrecondition.create({
    data: {
      id,
      testSuiteId,
      content: overrides.content ?? `Precondition ${id.slice(0, 8)}`,
      orderKey: overrides.orderKey ?? id.slice(0, 8),
    },
  });
}

/**
 * テスト用プロジェクト履歴を作成
 */
export async function createTestProjectHistory(
  projectId: string,
  overrides: Partial<{
    id: string;
    changedByUserId: string | null;
    changedByAgentSessionId: string | null;
    changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    snapshot: Prisma.InputJsonValue;
    changeReason: string | null;
    createdAt: Date;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.projectHistory.create({
    data: {
      id,
      projectId,
      changedByUserId: overrides.changedByUserId ?? null,
      changedByAgentSessionId: overrides.changedByAgentSessionId ?? null,
      changeType: overrides.changeType ?? 'CREATE',
      snapshot: overrides.snapshot ?? { name: 'Test Project' },
      changeReason: overrides.changeReason ?? null,
      createdAt: overrides.createdAt ?? new Date(),
    },
  });
}

/**
 * テスト用テストケースを作成
 */
export async function createTestCase(
  testSuiteId: string,
  overrides: Partial<{
    id: string;
    title: string;
    description: string | null;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    orderKey: string;
    createdByUserId: string | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testCase.create({
    data: {
      id,
      testSuiteId,
      title: overrides.title ?? `Test Case ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
      priority: overrides.priority ?? 'MEDIUM',
      status: overrides.status ?? 'DRAFT',
      orderKey: overrides.orderKey ?? id.slice(0, 5),
      createdByUserId: overrides.createdByUserId ?? null,
    },
  });
}

/**
 * テスト用テストケースステップを作成
 */
export async function createTestCaseStep(
  testCaseId: string,
  overrides: Partial<{
    id: string;
    content: string;
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testCaseStep.create({
    data: {
      id,
      testCaseId,
      content: overrides.content ?? `Step ${id.slice(0, 8)}`,
      orderKey: overrides.orderKey ?? id.slice(0, 5),
    },
  });
}

/**
 * テスト用テストケース期待結果を作成
 */
export async function createTestCaseExpectedResult(
  testCaseId: string,
  overrides: Partial<{
    id: string;
    content: string;
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testCaseExpectedResult.create({
    data: {
      id,
      testCaseId,
      content: overrides.content ?? `Expected Result ${id.slice(0, 8)}`,
      orderKey: overrides.orderKey ?? id.slice(0, 5),
    },
  });
}

/**
 * テスト用テストケース前提条件を作成
 */
export async function createTestCasePrecondition(
  testCaseId: string,
  overrides: Partial<{
    id: string;
    content: string;
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testCasePrecondition.create({
    data: {
      id,
      testCaseId,
      content: overrides.content ?? `Precondition ${id.slice(0, 8)}`,
      orderKey: overrides.orderKey ?? id.slice(0, 5),
    },
  });
}

/**
 * テスト用テストケース履歴を作成
 */
export async function createTestCaseHistory(
  testCaseId: string,
  overrides: Partial<{
    id: string;
    changedByUserId: string | null;
    changedByAgentSessionId: string | null;
    changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    snapshot: Prisma.InputJsonValue;
    changeReason: string | null;
    createdAt: Date;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testCaseHistory.create({
    data: {
      id,
      testCaseId,
      changedByUserId: overrides.changedByUserId ?? null,
      changedByAgentSessionId: overrides.changedByAgentSessionId ?? null,
      changeType: overrides.changeType ?? 'CREATE',
      snapshot: overrides.snapshot ?? { title: 'Test Case' },
      changeReason: overrides.changeReason ?? null,
      createdAt: overrides.createdAt ?? new Date(),
    },
  });
}

/**
 * テスト用レビューセッションを作成
 */
export async function createTestReview(
  testSuiteId: string,
  overrides: Partial<{
    id: string;
    authorUserId: string | null;
    authorAgentSessionId: string | null;
    status: 'DRAFT' | 'SUBMITTED';
    verdict: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENT_ONLY' | null;
    summary: string | null;
    submittedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.review.create({
    data: {
      id,
      testSuiteId,
      authorUserId: overrides.authorUserId ?? null,
      authorAgentSessionId: overrides.authorAgentSessionId ?? null,
      status: overrides.status ?? 'DRAFT',
      verdict: overrides.verdict ?? null,
      summary: overrides.summary ?? null,
      submittedAt: overrides.submittedAt ?? null,
    },
    include: {
      author: {
        select: { id: true, name: true, avatarUrl: true },
      },
      agentSession: {
        select: { id: true, clientName: true },
      },
      comments: true,
      _count: {
        select: { comments: true },
      },
    },
  });
}

/**
 * テスト用レビューコメントを作成
 */
export async function createTestReviewComment(
  reviewId: string,
  overrides: Partial<{
    id: string;
    targetType: 'SUITE' | 'CASE';
    targetId: string;
    targetField: 'TITLE' | 'DESCRIPTION' | 'PRECONDITION' | 'STEP' | 'EXPECTED_RESULT';
    targetItemId: string | null;
    authorUserId: string | null;
    authorAgentSessionId: string | null;
    content: string;
    status: 'OPEN' | 'RESOLVED';
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.reviewComment.create({
    data: {
      id,
      reviewId,
      targetType: overrides.targetType ?? 'SUITE',
      targetId: overrides.targetId ?? randomUUID(),
      targetField: overrides.targetField ?? 'TITLE',
      targetItemId: overrides.targetItemId ?? null,
      authorUserId: overrides.authorUserId ?? null,
      authorAgentSessionId: overrides.authorAgentSessionId ?? null,
      content: overrides.content ?? `Review Comment ${id.slice(0, 8)}`,
      status: overrides.status ?? 'OPEN',
    },
    include: {
      author: {
        select: { id: true, name: true, avatarUrl: true },
      },
      agentSession: {
        select: { id: true, clientName: true },
      },
      replies: true,
      _count: {
        select: { replies: true },
      },
    },
  });
}

/**
 * テスト用レビューコメント返信を作成
 */
export async function createTestReviewReply(
  commentId: string,
  overrides: Partial<{
    id: string;
    authorUserId: string | null;
    authorAgentSessionId: string | null;
    content: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.reviewCommentReply.create({
    data: {
      id,
      commentId,
      authorUserId: overrides.authorUserId ?? null,
      authorAgentSessionId: overrides.authorAgentSessionId ?? null,
      content: overrides.content ?? `Reply ${id.slice(0, 8)}`,
    },
    include: {
      author: {
        select: { id: true, name: true, avatarUrl: true },
      },
      agentSession: {
        select: { id: true, clientName: true },
      },
    },
  });
}

/**
 * テスト用リフレッシュトークンを作成
 */
export async function createTestRefreshToken(
  userId: string,
  overrides: Partial<{
    id: string;
    tokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.refreshToken.create({
    data: {
      id,
      userId,
      tokenHash: overrides.tokenHash ?? testHashToken(`refresh-token-${id}`),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: overrides.revokedAt ?? null,
    },
  });
}

/**
 * テスト用実行テストスイート（スナップショット）を作成
 */
export async function createTestExecutionTestSuite(
  executionId: string,
  originalTestSuiteId: string,
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionTestSuite.create({
    data: {
      id,
      executionId,
      originalTestSuiteId,
      name: overrides.name ?? `Execution Test Suite ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
    },
  });
}

/**
 * テスト用実行スイート前提条件（スナップショット）を作成
 */
export async function createTestExecutionTestSuitePrecondition(
  executionTestSuiteId: string,
  originalPreconditionId: string,
  overrides: Partial<{
    id: string;
    content: string;
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionTestSuitePrecondition.create({
    data: {
      id,
      executionTestSuiteId,
      originalPreconditionId,
      content: overrides.content ?? `Execution Suite Precondition ${id.slice(0, 8)}`,
      orderKey: overrides.orderKey ?? id.slice(0, 5),
    },
  });
}

/**
 * テスト用実行テストケース（スナップショット）を作成
 */
export async function createTestExecutionTestCase(
  executionTestSuiteId: string,
  originalTestCaseId: string,
  overrides: Partial<{
    id: string;
    title: string;
    description: string | null;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionTestCase.create({
    data: {
      id,
      executionTestSuiteId,
      originalTestCaseId,
      title: overrides.title ?? `Execution Test Case ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
      priority: overrides.priority ?? 'MEDIUM',
      orderKey: overrides.orderKey ?? id.slice(0, 5),
    },
  });
}

/**
 * テスト用実行ケース前提条件（スナップショット）を作成
 */
export async function createTestExecutionTestCasePrecondition(
  executionTestCaseId: string,
  originalPreconditionId: string,
  overrides: Partial<{
    id: string;
    content: string;
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionTestCasePrecondition.create({
    data: {
      id,
      executionTestCaseId,
      originalPreconditionId,
      content: overrides.content ?? `Execution Case Precondition ${id.slice(0, 8)}`,
      orderKey: overrides.orderKey ?? id.slice(0, 5),
    },
  });
}

/**
 * テスト用実行テストケースステップ（スナップショット）を作成
 */
export async function createTestExecutionTestCaseStep(
  executionTestCaseId: string,
  originalStepId: string,
  overrides: Partial<{
    id: string;
    content: string;
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionTestCaseStep.create({
    data: {
      id,
      executionTestCaseId,
      originalStepId,
      content: overrides.content ?? `Execution Step ${id.slice(0, 8)}`,
      orderKey: overrides.orderKey ?? id.slice(0, 5),
    },
  });
}

/**
 * テスト用実行テストケース期待結果（スナップショット）を作成
 */
export async function createTestExecutionTestCaseExpectedResult(
  executionTestCaseId: string,
  originalExpectedResultId: string,
  overrides: Partial<{
    id: string;
    content: string;
    orderKey: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionTestCaseExpectedResult.create({
    data: {
      id,
      executionTestCaseId,
      originalExpectedResultId,
      content: overrides.content ?? `Execution Expected Result ${id.slice(0, 8)}`,
      orderKey: overrides.orderKey ?? id.slice(0, 5),
    },
  });
}

/**
 * テスト用実行前提条件結果を作成
 */
export async function createTestExecutionPreconditionResult(
  executionId: string,
  overrides: Partial<{
    id: string;
    executionTestCaseId: string | null;
    executionSuitePreconditionId: string | null;
    executionCasePreconditionId: string | null;
    status: 'UNCHECKED' | 'MET' | 'NOT_MET';
    note: string | null;
    checkedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionPreconditionResult.create({
    data: {
      id,
      executionId,
      executionTestCaseId: overrides.executionTestCaseId ?? null,
      executionSuitePreconditionId: overrides.executionSuitePreconditionId ?? null,
      executionCasePreconditionId: overrides.executionCasePreconditionId ?? null,
      status: overrides.status ?? 'UNCHECKED',
      note: overrides.note ?? null,
      checkedAt: overrides.checkedAt ?? null,
    },
  });
}

/**
 * テスト用実行ステップ結果を作成
 */
export async function createTestExecutionStepResult(
  executionId: string,
  executionTestCaseId: string,
  executionStepId: string,
  overrides: Partial<{
    id: string;
    status: 'PENDING' | 'DONE' | 'SKIPPED';
    note: string | null;
    executedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionStepResult.create({
    data: {
      id,
      executionId,
      executionTestCaseId,
      executionStepId,
      status: overrides.status ?? 'PENDING',
      note: overrides.note ?? null,
      executedAt: overrides.executedAt ?? null,
    },
  });
}

/**
 * テスト用実行期待結果を作成
 */
export async function createTestExecutionExpectedResult(
  executionId: string,
  executionTestCaseId: string,
  executionExpectedResultId: string,
  overrides: Partial<{
    id: string;
    status: 'PENDING' | 'PASS' | 'FAIL' | 'SKIPPED';
    note: string | null;
    judgedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.executionExpectedResult.create({
    data: {
      id,
      executionId,
      executionTestCaseId,
      executionExpectedResultId,
      status: overrides.status ?? 'PENDING',
      note: overrides.note ?? null,
      judgedAt: overrides.judgedAt ?? null,
    },
  });
}

/**
 * テスト用OAuthクライアントを作成
 */
export async function createTestOAuthClient(
  overrides: Partial<{
    id: string;
    clientId: string;
    clientName: string;
    redirectUris: string[];
    grantTypes: string[];
    responseTypes: string[];
    tokenEndpointAuthMethod: string;
    scopes: string[];
    isActive: boolean;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  const clientId = overrides.clientId ?? randomUUID();
  return prisma.oAuthClient.create({
    data: {
      id,
      clientId,
      clientName: overrides.clientName ?? `Test OAuth Client ${id.slice(0, 8)}`,
      redirectUris: overrides.redirectUris ?? ['http://localhost:8080/callback'],
      grantTypes: overrides.grantTypes ?? ['authorization_code'],
      responseTypes: overrides.responseTypes ?? ['code'],
      tokenEndpointAuthMethod: overrides.tokenEndpointAuthMethod ?? 'none',
      scopes: overrides.scopes ?? ['mcp:read', 'mcp:write'],
      isActive: overrides.isActive ?? true,
    },
  });
}

/**
 * テスト用OAuth認可コードを作成
 */
export async function createTestOAuthAuthorizationCode(
  clientId: string,
  userId: string,
  overrides: Partial<{
    id: string;
    code: string;
    redirectUri: string;
    scopes: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
    resource: string;
    expiresAt: Date;
    usedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.oAuthAuthorizationCode.create({
    data: {
      id,
      code: overrides.code ?? `code-${id}`,
      clientId,
      userId,
      redirectUri: overrides.redirectUri ?? 'http://localhost:8080/callback',
      scopes: overrides.scopes ?? ['mcp:read'],
      codeChallenge: overrides.codeChallenge ?? 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      codeChallengeMethod: overrides.codeChallengeMethod ?? 'S256',
      resource: overrides.resource ?? 'http://localhost:3002',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
      usedAt: overrides.usedAt ?? null,
    },
  });
}

/**
 * テスト用OAuthアクセストークンを作成
 */
export async function createTestOAuthAccessToken(
  clientId: string,
  userId: string,
  overrides: Partial<{
    id: string;
    tokenHash: string;
    scopes: string[];
    audience: string;
    expiresAt: Date;
    revokedAt: Date | null;
    refreshTokenId: string | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.oAuthAccessToken.create({
    data: {
      id,
      tokenHash: overrides.tokenHash ?? `hash-${id}`,
      clientId,
      userId,
      scopes: overrides.scopes ?? ['mcp:read'],
      audience: overrides.audience ?? 'http://localhost:3002',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: overrides.revokedAt ?? null,
      refreshTokenId: overrides.refreshTokenId ?? null,
    },
  });
}

/**
 * テスト用OAuthリフレッシュトークンを作成
 */
export async function createTestOAuthRefreshToken(
  clientId: string,
  userId: string,
  overrides: Partial<{
    id: string;
    tokenHash: string;
    scopes: string[];
    audience: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.oAuthRefreshToken.create({
    data: {
      id,
      tokenHash: overrides.tokenHash ?? testHashToken(`refresh-token-${id}`),
      clientId,
      userId,
      scopes: overrides.scopes ?? ['mcp:read'],
      audience: overrides.audience ?? 'http://localhost:3002',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日
      revokedAt: overrides.revokedAt ?? null,
    },
  });
}

/**
 * テスト用ラベルを作成
 */
export async function createTestLabel(
  projectId: string,
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    color: string;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.label.create({
    data: {
      id,
      projectId,
      name: overrides.name ?? `Label ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
      color: overrides.color ?? '#3B82F6',
    },
  });
}

/**
 * テスト用テストスイートラベルを作成
 */
export async function createTestSuiteLabel(testSuiteId: string, labelId: string) {
  return prisma.testSuiteLabel.create({
    data: { testSuiteId, labelId },
  });
}

/**
 * テスト用支払い方法を作成
 */
export async function createTestPaymentMethod(
  userId: string,
  overrides: Partial<{
    id: string;
    externalId: string;
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.paymentMethod.create({
    data: {
      id,
      userId,
      type: 'CARD',
      externalId: overrides.externalId ?? `pm_test_${id.slice(0, 8)}`,
      brand: overrides.brand ?? 'visa',
      last4: overrides.last4 ?? '4242',
      expiryMonth: overrides.expiryMonth ?? 12,
      expiryYear: overrides.expiryYear ?? 2030,
      isDefault: overrides.isDefault ?? false,
    },
  });
}

/**
 * テスト用組織向け支払い方法を作成
 */
export async function createTestOrgPaymentMethod(
  organizationId: string,
  overrides: Partial<{
    id: string;
    externalId: string;
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.paymentMethod.create({
    data: {
      id,
      organizationId,
      type: 'CARD',
      externalId: overrides.externalId ?? `pm_test_${id.slice(0, 8)}`,
      brand: overrides.brand ?? 'visa',
      last4: overrides.last4 ?? '4242',
      expiryMonth: overrides.expiryMonth ?? 12,
      expiryYear: overrides.expiryYear ?? 2030,
      isDefault: overrides.isDefault ?? false,
    },
  });
}

// ==================== 管理者関連テストヘルパー ====================

/**
 * テスト用管理者ユーザーを作成
 */
export async function createTestAdminUser(
  overrides: Partial<{
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
    totpEnabled: boolean;
    failedAttempts: number;
    lockedUntil: Date | null;
    deletedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  // デフォルトのパスワードハッシュ
  // 注: このハッシュはダミー値であり、結合テストでは bcryptjs.hashSync(testPassword, 12) で
  // 実際のパスワードをハッシュ化してoverrideすることを想定
  // ユニットテストではリポジトリをモックするため、このハッシュが使用されることはない
  const defaultPasswordHash =
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4bEaLwrMlxAqP6C2';
  return prisma.adminUser.create({
    data: {
      id,
      email: overrides.email ?? `admin-${id.slice(0, 8)}@example.com`,
      passwordHash: overrides.passwordHash ?? defaultPasswordHash,
      name: overrides.name ?? `Admin User ${id.slice(0, 8)}`,
      role: overrides.role ?? 'ADMIN',
      totpEnabled: overrides.totpEnabled ?? false,
      failedAttempts: overrides.failedAttempts ?? 0,
      lockedUntil: overrides.lockedUntil ?? null,
      deletedAt: overrides.deletedAt ?? null,
    },
  });
}

/**
 * テスト用管理者セッションを作成
 */
export async function createTestAdminSession(
  adminUserId: string,
  overrides: Partial<{
    id: string;
    tokenHash: string;
    userAgent: string;
    ipAddress: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.adminSession.create({
    data: {
      id,
      adminUserId,
      tokenHash: overrides.tokenHash ?? testHashToken(`admin-session-token-${id}`),
      userAgent: overrides.userAgent ?? 'Mozilla/5.0 Test Browser',
      ipAddress: overrides.ipAddress ?? '127.0.0.1',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000), // 2時間後
      revokedAt: overrides.revokedAt ?? null,
    },
  });
}

/**
 * テスト用管理者監査ログを作成
 */
export async function createTestAdminAuditLog(
  adminUserId: string,
  overrides: Partial<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    details: Prisma.InputJsonValue;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.adminAuditLog.create({
    data: {
      id,
      adminUserId,
      action: overrides.action ?? 'TEST_ACTION',
      targetType: overrides.targetType ?? null,
      targetId: overrides.targetId ?? null,
      details: overrides.details,
      ipAddress: overrides.ipAddress ?? null,
      userAgent: overrides.userAgent ?? null,
      createdAt: overrides.createdAt ?? new Date(),
    },
  });
}

// ==================== 課金関連テストヘルパー ====================

/**
 * テスト用サブスクリプションを作成
 */
export async function createTestSubscription(
  overrides: Partial<{
    id: string;
    userId: string | null;
    organizationId: string | null;
    plan: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
    status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
    billingCycle: 'MONTHLY' | 'YEARLY';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  const now = new Date();
  return prisma.subscription.create({
    data: {
      id,
      userId: overrides.userId ?? null,
      organizationId: overrides.organizationId ?? null,
      plan: overrides.plan ?? 'FREE',
      status: overrides.status ?? 'ACTIVE',
      billingCycle: overrides.billingCycle ?? 'MONTHLY',
      currentPeriodStart: overrides.currentPeriodStart ?? now,
      currentPeriodEnd: overrides.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
    },
  });
}

/**
 * テスト用インボイスを作成
 */
export async function createTestInvoice(
  subscriptionId: string,
  overrides: Partial<{
    id: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: 'PENDING' | 'PAID' | 'FAILED' | 'VOID';
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
    pdfUrl: string | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  const now = new Date();
  return prisma.invoice.create({
    data: {
      id,
      subscriptionId,
      invoiceNumber: overrides.invoiceNumber ?? `INV-${id.slice(0, 8).toUpperCase()}`,
      amount: overrides.amount ?? 980,
      currency: overrides.currency ?? 'JPY',
      status: overrides.status ?? 'PENDING',
      periodStart: overrides.periodStart ?? now,
      periodEnd: overrides.periodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      dueDate: overrides.dueDate ?? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      pdfUrl: overrides.pdfUrl ?? null,
    },
  });
}

// ==================== メトリクス関連テストヘルパー ====================

/**
 * テスト用アクティブユーザーメトリクスを作成
 */
export async function createTestActiveUserMetric(
  overrides: Partial<{
    id: string;
    granularity: 'DAY' | 'WEEK' | 'MONTH';
    periodStart: Date;
    userCount: number;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.activeUserMetric.create({
    data: {
      id,
      granularity: overrides.granularity ?? 'DAY',
      periodStart: overrides.periodStart ?? new Date(),
      userCount: overrides.userCount ?? 0,
    },
  });
}
