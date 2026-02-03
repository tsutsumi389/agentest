import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticationError, AuthorizationError } from '@agentest/shared';

// Prismaのモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaOrganizationMember = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockPrismaProject = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    organizationMember: mockPrismaOrganizationMember,
    project: mockPrismaProject,
  },
}));

// JWTモジュールのモック（使用しないが、middleware.jsのインポートに必要）
vi.mock('../jwt.js', () => ({
  verifyAccessToken: vi.fn(),
}));

// モック設定後にインポート
import { requireProjectRole } from '../middleware.js';
import {
  TEST_USER_ID,
  TEST_ORG_ID,
  TEST_PROJECT_ID,
  testUser,
  createMockRequest,
  createMockResponse,
  createMockNext,
  getErrorFromMockNext,
} from './helpers.js';

describe('requireProjectRole', () => {
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = createMockNext();
  });

  it('プロジェクトメンバーはアクセスできる', async () => {
    mockPrismaProject.findUnique.mockResolvedValue({
      id: TEST_PROJECT_ID,
      deletedAt: null,
      organizationId: null,
      members: [{ userId: TEST_USER_ID, role: 'EDITOR' }],
    });

    const req = createMockRequest({
      user: testUser,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['EDITOR', 'VIEWER']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('OWNERは全権限を持つ', async () => {
    mockPrismaProject.findUnique.mockResolvedValue({
      id: TEST_PROJECT_ID,
      deletedAt: null,
      organizationId: null,
      members: [{ userId: TEST_USER_ID, role: 'OWNER' }],
    });

    const req = createMockRequest({
      user: testUser,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    // VIEWERのみを要求しているが、OWNERなのでアクセス可能
    const middleware = requireProjectRole(['VIEWER']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('ロールが不足しているメンバーは拒否される', async () => {
    mockPrismaProject.findUnique.mockResolvedValue({
      id: TEST_PROJECT_ID,
      deletedAt: null,
      organizationId: null,
      members: [{ userId: TEST_USER_ID, role: 'VIEWER' }],
    });

    const req = createMockRequest({
      user: testUser,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['EDITOR', 'OWNER']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('未認証ユーザーは拒否される', async () => {
    const req = createMockRequest({
      user: undefined,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['VIEWER']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
  });

  it('プロジェクトIDがない場合は拒否される', async () => {
    const req = createMockRequest({
      user: testUser,
      params: {},
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['VIEWER']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = getErrorFromMockNext(mockNext);
    expect(error?.message).toBe('Project ID required');
  });

  it('プロジェクトが見つからない場合は拒否される', async () => {
    mockPrismaProject.findUnique.mockResolvedValue(null);

    const req = createMockRequest({
      user: testUser,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['VIEWER']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = getErrorFromMockNext(mockNext);
    expect(error?.message).toBe('Project not found');
  });

  it('削除済みプロジェクトへのアクセスは拒否される', async () => {
    mockPrismaProject.findUnique.mockResolvedValue({
      id: TEST_PROJECT_ID,
      deletedAt: new Date(),
      organizationId: null,
      members: [{ userId: TEST_USER_ID, role: 'EDITOR' }],
    });

    const req = createMockRequest({
      user: testUser,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['EDITOR']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = getErrorFromMockNext(mockNext);
    expect(error?.message).toBe('Project has been deleted');
  });

  it('allowDeletedProject: trueで削除済みプロジェクトへのアクセスを許可', async () => {
    mockPrismaProject.findUnique.mockResolvedValue({
      id: TEST_PROJECT_ID,
      deletedAt: new Date(),
      organizationId: null,
      members: [{ userId: TEST_USER_ID, role: 'EDITOR' }],
    });

    const req = createMockRequest({
      user: testUser,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['EDITOR'], {
      allowDeletedProject: true,
    });

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('組織のOWNER/ADMINはプロジェクトにアクセスできる', async () => {
    mockPrismaProject.findUnique.mockResolvedValue({
      id: TEST_PROJECT_ID,
      deletedAt: null,
      organizationId: TEST_ORG_ID,
      members: [], // プロジェクトメンバーではない
    });
    mockPrismaOrganizationMember.findUnique.mockResolvedValue({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      role: 'ADMIN',
    });

    const req = createMockRequest({
      user: testUser,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['EDITOR']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('組織のMEMBERはプロジェクトにアクセスできない', async () => {
    mockPrismaProject.findUnique.mockResolvedValue({
      id: TEST_PROJECT_ID,
      deletedAt: null,
      organizationId: TEST_ORG_ID,
      members: [], // プロジェクトメンバーではない
    });
    mockPrismaOrganizationMember.findUnique.mockResolvedValue({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      role: 'MEMBER', // MEMBER権限のみ
    });

    const req = createMockRequest({
      user: testUser,
      params: { projectId: TEST_PROJECT_ID },
    });
    const res = createMockResponse();
    const middleware = requireProjectRole(['EDITOR']);

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });
});
