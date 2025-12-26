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
 * テストデータをクリーンアップ
 */
export async function cleanupTestData() {
  // 外部キー制約を考慮した順序で削除
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
