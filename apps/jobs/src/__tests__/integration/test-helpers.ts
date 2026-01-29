/**
 * 結合テスト用ヘルパー関数
 */
import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@agentest/db';
import { randomUUID } from 'crypto';

// ============================================
// 日付ユーティリティ
// ============================================

/**
 * N日前の日付を取得
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// ============================================
// ユーザー作成
// ============================================

/**
 * テスト用ユーザーを作成
 */
export async function createTestUser(
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    plan: 'FREE' | 'PRO';
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: overrides.email ?? `test-${id}@example.com`,
      name: overrides.name ?? `Test User ${id.slice(0, 8)}`,
      avatarUrl: overrides.avatarUrl ?? null,
      plan: overrides.plan ?? 'FREE',
    },
  });
}

// ============================================
// サブスクリプション作成
// ============================================

/**
 * テスト用サブスクリプションを作成
 */
export async function createTestSubscription(
  overrides: Partial<{
    id: string;
    userId: string | null;
    organizationId: string | null;
    externalId: string | null;
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
      externalId: overrides.externalId ?? null,
      plan: overrides.plan ?? 'FREE',
      status: overrides.status ?? 'ACTIVE',
      billingCycle: overrides.billingCycle ?? 'MONTHLY',
      currentPeriodStart: overrides.currentPeriodStart ?? now,
      currentPeriodEnd:
        overrides.currentPeriodEnd ??
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
    },
  });
}

// ============================================
// PaymentEvent作成
// ============================================

/**
 * テスト用PaymentEventを作成
 */
export async function createTestPaymentEvent(
  overrides: Partial<{
    id: string;
    externalId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    status: 'PENDING' | 'PROCESSED' | 'FAILED';
    retryCount: number;
    errorMessage: string | null;
    processedAt: Date | null;
    createdAt: Date;
  }> = {}
) {
  const id = overrides.id ?? randomUUID();
  return prisma.paymentEvent.create({
    data: {
      id,
      externalId: overrides.externalId ?? `evt_${id.slice(0, 8)}`,
      eventType: overrides.eventType ?? 'invoice.paid',
      payload: overrides.payload ?? { type: 'test' },
      status: overrides.status ?? 'PENDING',
      retryCount: overrides.retryCount ?? 0,
      errorMessage: overrides.errorMessage ?? null,
      processedAt: overrides.processedAt ?? null,
      ...(overrides.createdAt && { createdAt: overrides.createdAt }),
    },
  });
}

// ============================================
// Invoice作成
// ============================================

/**
 * テスト用Invoiceを作成
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
      invoiceNumber:
        overrides.invoiceNumber ?? `INV-${id.slice(0, 8).toUpperCase()}`,
      amount: overrides.amount ?? 980,
      currency: overrides.currency ?? 'JPY',
      status: overrides.status ?? 'PENDING',
      periodStart: overrides.periodStart ?? now,
      periodEnd:
        overrides.periodEnd ??
        new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      dueDate:
        overrides.dueDate ??
        new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      pdfUrl: overrides.pdfUrl ?? null,
    },
  });
}

// ============================================
// 組織作成
// ============================================

/**
 * テスト用組織を作成
 */
export async function createTestOrganization(
  ownerId: string,
  overrides: Partial<{
    id: string;
    name: string;
    description: string | null;
    plan: 'TEAM' | 'ENTERPRISE';
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

// ============================================
// プロジェクト作成
// ============================================

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
 * テスト用削除済みプロジェクトを作成
 * deletedAtを指定してソフトデリート状態のプロジェクトを作成する
 */
export async function createDeletedTestProject(
  ownerId: string,
  deletedAt: Date,
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
        name: overrides.name ?? `Deleted Project ${id.slice(0, 8)}`,
        description: overrides.description ?? null,
        organizationId: overrides.organizationId ?? null,
        deletedAt,
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

// ============================================
// テストスイート作成
// ============================================

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

// ============================================
// テストケース作成
// ============================================

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

// ============================================
// 履歴作成
// ============================================

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
 * テスト用テストスイート履歴を作成
 */
export async function createTestSuiteHistory(
  testSuiteId: string,
  overrides: Partial<{
    id: string;
    changedByUserId: string | null;
    changedByAgentSessionId: string | null;
    changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
    snapshot: Prisma.InputJsonValue;
    changeReason: string | null;
    groupId: string | null;
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
      groupId: overrides.groupId ?? null,
      createdAt: overrides.createdAt ?? new Date(),
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

// ============================================
// クリーンアップ
// ============================================

/**
 * テストデータをクリーンアップ
 */
export async function cleanupTestData() {
  // 外部キー制約を考慮した順序で削除
  await prisma.paymentEvent.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.paymentMethod.deleteMany({});
  await prisma.testCaseHistory.deleteMany({});
  await prisma.testSuiteHistory.deleteMany({});
  await prisma.projectHistory.deleteMany({});
  await prisma.testCaseExpectedResult.deleteMany({});
  await prisma.testCaseStep.deleteMany({});
  await prisma.testCasePrecondition.deleteMany({});
  await prisma.testCase.deleteMany({});
  await prisma.testSuitePrecondition.deleteMany({});
  await prisma.testSuiteLabel.deleteMany({});
  await prisma.testSuite.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.organizationMember.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
}

// ============================================
// テストデータセット作成（複合）
// ============================================

/**
 * 履歴クリーンアップテスト用データセットを作成
 */
export async function createHistoryCleanupTestData(options: {
  userId?: string;
  plan?: 'FREE' | 'PRO';
  historyAge: number;
}) {
  // ユーザー作成
  const user = await createTestUser({
    id: options.userId,
    plan: options.plan ?? 'FREE',
  });

  // サブスクリプション作成
  await createTestSubscription({
    userId: user.id,
    plan: options.plan ?? 'FREE',
  });

  // プロジェクト作成
  const project = await createTestProject(user.id);

  // テストスイート作成
  const testSuite = await createTestSuite(project.id);

  // テストケース作成
  const testCase = await createTestCase(testSuite.id);

  // 履歴作成（指定した日数前）
  const historyDate = daysAgo(options.historyAge);

  const testCaseHistory = await createTestCaseHistory(testCase.id, {
    createdAt: historyDate,
  });

  const testSuiteHistory = await createTestSuiteHistory(testSuite.id, {
    createdAt: historyDate,
  });

  const projectHistory = await createTestProjectHistory(project.id, {
    createdAt: historyDate,
  });

  return {
    user,
    project,
    testSuite,
    testCase,
    testCaseHistory,
    testSuiteHistory,
    projectHistory,
  };
}
