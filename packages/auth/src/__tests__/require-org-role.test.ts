import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticationError, AuthorizationError } from '@agentest/shared';

// Prismaのモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaOrganizationMember = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    organizationMember: mockPrismaOrganizationMember,
  },
}));

// JWTモジュールのモック（使用しないが、middleware.jsのインポートに必要）
vi.mock('../jwt.js', () => ({
  verifyAccessToken: vi.fn(),
}));

// モック設定後にインポート
import { requireOrgRole } from '../middleware.js';
import {
  TEST_USER_ID,
  TEST_ORG_ID,
  testUser,
  createMockRequest,
  createMockResponse,
  createMockNext,
  getErrorFromMockNext,
} from './helpers.js';

describe('requireOrgRole', () => {
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = createMockNext();
  });

  it('必要なロールを持つメンバーはアクセスできる', async () => {
    mockPrismaOrganizationMember.findUnique.mockResolvedValue({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      role: 'ADMIN',
      organization: { deletedAt: null },
    });

    const req = createMockRequest({
      user: testUser,
      params: { organizationId: TEST_ORG_ID },
    });
    const res = createMockResponse();
    const middleware = requireOrgRole(['ADMIN', 'OWNER']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('ロールが不足しているメンバーは拒否される', async () => {
    mockPrismaOrganizationMember.findUnique.mockResolvedValue({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      role: 'MEMBER',
      organization: { deletedAt: null },
    });

    const req = createMockRequest({
      user: testUser,
      params: { organizationId: TEST_ORG_ID },
    });
    const res = createMockResponse();
    const middleware = requireOrgRole(['ADMIN', 'OWNER']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = getErrorFromMockNext(mockNext);
    expect(error?.message).toBe('Insufficient permissions');
  });

  it('未認証ユーザーは拒否される', async () => {
    const req = createMockRequest({
      user: undefined,
      params: { organizationId: TEST_ORG_ID },
    });
    const res = createMockResponse();
    const middleware = requireOrgRole(['ADMIN']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const error = getErrorFromMockNext(mockNext);
    expect(error?.message).toBe('Not authenticated');
  });

  it('組織IDがない場合は拒否される', async () => {
    const req = createMockRequest({
      user: testUser,
      params: {},
    });
    const res = createMockResponse();
    const middleware = requireOrgRole(['ADMIN']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = getErrorFromMockNext(mockNext);
    expect(error?.message).toBe('Organization ID required');
  });

  it('メンバーでない場合は拒否される', async () => {
    mockPrismaOrganizationMember.findUnique.mockResolvedValue(null);

    const req = createMockRequest({
      user: testUser,
      params: { organizationId: TEST_ORG_ID },
    });
    const res = createMockResponse();
    const middleware = requireOrgRole(['ADMIN']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('削除済み組織へのアクセスは拒否される', async () => {
    mockPrismaOrganizationMember.findUnique.mockResolvedValue({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      role: 'ADMIN',
      organization: { deletedAt: new Date() },
    });

    const req = createMockRequest({
      user: testUser,
      params: { organizationId: TEST_ORG_ID },
    });
    const res = createMockResponse();
    const middleware = requireOrgRole(['ADMIN']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = getErrorFromMockNext(mockNext);
    expect(error?.message).toBe('Organization has been deleted');
  });

  it('allowDeletedOrg: trueで削除済み組織へのアクセスを許可', async () => {
    mockPrismaOrganizationMember.findUnique.mockResolvedValue({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      role: 'ADMIN',
      organization: { deletedAt: new Date() },
    });

    const req = createMockRequest({
      user: testUser,
      params: { organizationId: TEST_ORG_ID },
    });
    const res = createMockResponse();
    const middleware = requireOrgRole(['ADMIN'], { allowDeletedOrg: true });

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('bodyからorganizationIdを取得できる', async () => {
    mockPrismaOrganizationMember.findUnique.mockResolvedValue({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      role: 'ADMIN',
      organization: { deletedAt: null },
    });

    const req = createMockRequest({
      user: testUser,
      params: {},
      body: { organizationId: TEST_ORG_ID },
    });
    const res = createMockResponse();
    const middleware = requireOrgRole(['ADMIN']);

    await middleware(req, res, mockNext);

    expect(mockPrismaOrganizationMember.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: TEST_ORG_ID,
          userId: TEST_USER_ID,
        },
      },
      include: {
        organization: {
          select: { deletedAt: true },
        },
      },
    });
  });
});
