import { prisma } from '@agentest/db';
import { randomUUID } from 'crypto';

/**
 * テスト用ユーザーを作成
 */
export async function createTestUser(
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }> = {}
) {
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
 * テスト用AgentSessionを作成
 */
export async function createTestAgentSession(
  projectId: string,
  overrides: Partial<{
    id: string;
    clientId: string;
    clientName: string | null;
    status: 'ACTIVE' | 'ENDED' | 'TIMEOUT';
    lastHeartbeat: Date;
    startedAt: Date;
    endedAt: Date | null;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.agentSession.create({
    data: {
      id,
      projectId,
      clientId: overrides.clientId ?? `client-${id.slice(0, 8)}`,
      clientName: overrides.clientName ?? null,
      status: overrides.status ?? 'ACTIVE',
      lastHeartbeat: overrides.lastHeartbeat ?? new Date(),
      startedAt: overrides.startedAt ?? new Date(),
      endedAt: overrides.endedAt ?? null,
    },
  });
}

/**
 * テストデータをクリーンアップ
 */
export async function cleanupTestData() {
  // 外部キー制約を考慮した順序で削除
  await prisma.reviewCommentReply.deleteMany({});
  await prisma.reviewComment.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.executionEvidence.deleteMany({});
  await prisma.executionExpectedResult.deleteMany({});
  await prisma.executionStepResult.deleteMany({});
  await prisma.executionPreconditionResult.deleteMany({});
  await prisma.executionSnapshot.deleteMany({});
  await prisma.execution.deleteMany({});
  await prisma.testSuiteHistory.deleteMany({});
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
  await prisma.agentSession.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.organizationInvitation.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
}
