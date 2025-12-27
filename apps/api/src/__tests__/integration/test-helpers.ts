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
 * テストデータをクリーンアップ
 */
export async function cleanupTestData() {
  // 外部キー制約を考慮した順序で削除
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
