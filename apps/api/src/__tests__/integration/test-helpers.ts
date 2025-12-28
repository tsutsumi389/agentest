import { prisma } from '@agentest/db';
import { randomUUID } from 'crypto';

/**
 * テスト用ユーザーを作成
 */
export async function createTestUser(overrides: Partial<{
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}> = {}) {
  const id = overrides.id ?? randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: overrides.email ?? `test-${id}@example.com`,
      name: overrides.name ?? `Test User ${id.slice(0, 8)}`,
      avatarUrl: overrides.avatarUrl ?? null,
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
    token: string;
    userAgent: string;
    ipAddress: string;
    expiresAt: Date;
    revokedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.session.create({
    data: {
      id,
      userId,
      token: overrides.token ?? `token-${id}`,
      userAgent: overrides.userAgent ?? 'Mozilla/5.0 Test Browser',
      ipAddress: overrides.ipAddress ?? '127.0.0.1',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
    slug: string;
    description: string | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  const org = await prisma.organization.create({
    data: {
      id,
      name: overrides.name ?? `Test Org ${id.slice(0, 8)}`,
      slug: overrides.slug ?? `test-org-${id.slice(0, 8)}`,
      description: overrides.description ?? null,
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
    details: Record<string, unknown> | null;
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
      details: overrides.details ?? null,
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
  await prisma.auditLog.deleteMany({});
  await prisma.execution.deleteMany({});
  await prisma.testSuiteHistory.deleteMany({});
  await prisma.testSuitePrecondition.deleteMany({});
  await prisma.testSuite.deleteMany({});
  await prisma.projectEnvironment.deleteMany({});
  await prisma.projectHistory.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.organizationInvitation.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.organization.deleteMany({});
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
  return prisma.project.create({
    data: {
      id,
      name: overrides.name ?? `Test Project ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
      ownerId,
      organizationId: overrides.organizationId ?? null,
    },
  });
}

/**
 * テスト用プロジェクトメンバーを作成
 */
export async function createTestProjectMember(
  projectId: string,
  userId: string,
  role: 'ADMIN' | 'WRITE' | 'READ' = 'READ'
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
    slug: string;
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
      slug: overrides.slug ?? `env-${id.slice(0, 8)}`,
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
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testSuite.create({
    data: {
      id,
      projectId,
      name: overrides.name ?? `Test Suite ${id.slice(0, 8)}`,
      description: overrides.description ?? null,
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
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.execution.create({
    data: {
      id,
      environmentId,
      testSuiteId,
      status: overrides.status ?? 'IN_PROGRESS',
    },
  });
}

/**
 * テスト用テストスイート履歴を作成
 */
export async function createTestSuiteHistory(
  testSuiteId: string,
  overrides: Partial<{
    id: string;
    changedByUserId: string | null;
    changedByAgentSessionId: string | null;
    changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    snapshot: Record<string, unknown>;
    changeReason: string | null;
    createdAt: Date;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.testSuiteHistory.create({
    data: {
      id,
      testSuiteId,
      changedByUserId: overrides.changedByUserId ?? null,
      changedByAgentSessionId: overrides.changedByAgentSessionId ?? null,
      changeType: overrides.changeType ?? 'CREATE',
      snapshot: overrides.snapshot ?? { name: 'Test Suite' },
      changeReason: overrides.changeReason ?? null,
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
    snapshot: Record<string, unknown>;
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
