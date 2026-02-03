import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError } from '@agentest/shared';

// Prismaのモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockPrismaOrganizationMember = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockPrismaProject = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: mockPrismaUser,
    organizationMember: mockPrismaOrganizationMember,
    project: mockPrismaProject,
  },
}));

// JWTモジュールのモック
const mockVerifyAccessToken = vi.hoisted(() => vi.fn());

vi.mock('./jwt.js', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

// モック設定後にインポート
import {
  authenticate,
  requireAuth,
  optionalAuth,
  requireOrgRole,
  requireProjectRole,
} from './middleware.js';
import type { AuthConfig, JwtPayload } from './types.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const TEST_PROJECT_ID = '33333333-3333-3333-3333-333333333333';
const TEST_ACCESS_TOKEN = 'valid-access-token';

// テスト用の設定
const testConfig: AuthConfig = {
  jwt: {
    accessSecret: 'test-access-secret',
    refreshSecret: 'test-refresh-secret',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
  },
  oauth: {},
};

// テスト用のJWTペイロード
const testPayload: JwtPayload = {
  sub: TEST_USER_ID,
  email: 'test@example.com',
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
};

// テスト用のユーザー
const testUser = {
  id: TEST_USER_ID,
  email: 'test@example.com',
  name: 'Test User',
  deletedAt: null,
};

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers: {},
    cookies: {},
    params: {},
    body: {},
    user: undefined,
    token: undefined,
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('authenticate', () => {
    describe('トークン抽出', () => {
      it('Authorizationヘッダーからトークンを抽出する', async () => {
        mockVerifyAccessToken.mockReturnValue(testPayload);
        mockPrismaUser.findUnique.mockResolvedValue(testUser);

        const req = createMockRequest({
          headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig });

        await middleware(req as Request, res as Response, mockNext);

        expect(mockVerifyAccessToken).toHaveBeenCalledWith(
          TEST_ACCESS_TOKEN,
          testConfig
        );
      });

      it('クッキーからトークンを抽出する', async () => {
        mockVerifyAccessToken.mockReturnValue(testPayload);
        mockPrismaUser.findUnique.mockResolvedValue(testUser);

        const req = createMockRequest({
          cookies: { access_token: TEST_ACCESS_TOKEN },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig });

        await middleware(req as Request, res as Response, mockNext);

        expect(mockVerifyAccessToken).toHaveBeenCalledWith(
          TEST_ACCESS_TOKEN,
          testConfig
        );
      });

      it('Authorizationヘッダーがクッキーより優先される', async () => {
        mockVerifyAccessToken.mockReturnValue(testPayload);
        mockPrismaUser.findUnique.mockResolvedValue(testUser);

        const req = createMockRequest({
          headers: { authorization: 'Bearer header-token' },
          cookies: { access_token: 'cookie-token' },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig });

        await middleware(req as Request, res as Response, mockNext);

        expect(mockVerifyAccessToken).toHaveBeenCalledWith(
          'header-token',
          testConfig
        );
      });
    });

    describe('必須認証 (optional: false)', () => {
      it('有効なトークンでユーザーを設定しnextを呼ぶ', async () => {
        mockVerifyAccessToken.mockReturnValue(testPayload);
        mockPrismaUser.findUnique.mockResolvedValue(testUser);

        const req = createMockRequest({
          headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig, optional: false });

        await middleware(req as Request, res as Response, mockNext);

        expect(req.user).toEqual(testUser);
        expect(req.token).toEqual(testPayload);
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('トークンがない場合エラーをnextに渡す', async () => {
        const req = createMockRequest({});
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig, optional: false });

        await middleware(req as Request, res as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
        expect((mockNext as any).mock.calls[0][0].message).toBe(
          'No authentication token provided'
        );
      });

      it('無効なトークンでエラーをnextに渡す', async () => {
        mockVerifyAccessToken.mockImplementation(() => {
          throw new AuthenticationError('Invalid token');
        });

        const req = createMockRequest({
          headers: { authorization: `Bearer invalid-token` },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig, optional: false });

        await middleware(req as Request, res as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      });

      it('ユーザーが見つからない場合エラーをnextに渡す', async () => {
        mockVerifyAccessToken.mockReturnValue(testPayload);
        mockPrismaUser.findUnique.mockResolvedValue(null);

        const req = createMockRequest({
          headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig, optional: false });

        await middleware(req as Request, res as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
        expect((mockNext as any).mock.calls[0][0].message).toBe('User not found');
      });

      it('削除済みユーザーの場合エラーをnextに渡す', async () => {
        mockVerifyAccessToken.mockReturnValue(testPayload);
        mockPrismaUser.findUnique.mockResolvedValue({
          ...testUser,
          deletedAt: new Date(),
        });

        const req = createMockRequest({
          headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig, optional: false });

        await middleware(req as Request, res as Response, mockNext);

        expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
        expect((mockNext as any).mock.calls[0][0].message).toBe('User not found');
      });
    });

    describe('任意認証 (optional: true)', () => {
      it('トークンがない場合はユーザーなしでnextを呼ぶ', async () => {
        const req = createMockRequest({});
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig, optional: true });

        await middleware(req as Request, res as Response, mockNext);

        expect(req.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('無効なトークンでもユーザーなしでnextを呼ぶ', async () => {
        mockVerifyAccessToken.mockImplementation(() => {
          throw new AuthenticationError('Invalid token');
        });

        const req = createMockRequest({
          headers: { authorization: 'Bearer invalid-token' },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig, optional: true });

        await middleware(req as Request, res as Response, mockNext);

        expect(req.user).toBeUndefined();
        expect(mockNext).toHaveBeenCalledWith();
      });

      it('有効なトークンではユーザーを設定する', async () => {
        mockVerifyAccessToken.mockReturnValue(testPayload);
        mockPrismaUser.findUnique.mockResolvedValue(testUser);

        const req = createMockRequest({
          headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
        });
        const res = createMockResponse();
        const middleware = authenticate({ config: testConfig, optional: true });

        await middleware(req as Request, res as Response, mockNext);

        expect(req.user).toEqual(testUser);
        expect(mockNext).toHaveBeenCalledWith();
      });
    });
  });

  describe('requireAuth', () => {
    it('optional: falseでauthenticateを呼ぶ', async () => {
      mockVerifyAccessToken.mockReturnValue(testPayload);
      mockPrismaUser.findUnique.mockResolvedValue(testUser);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      });
      const res = createMockResponse();
      const middleware = requireAuth(testConfig);

      await middleware(req as Request, res as Response, mockNext);

      expect(req.user).toEqual(testUser);
    });
  });

  describe('optionalAuth', () => {
    it('optional: trueでauthenticateを呼ぶ', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const middleware = optionalAuth(testConfig);

      await middleware(req as Request, res as Response, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireOrgRole', () => {
    beforeEach(() => {
      // 認証済みユーザーを設定
      mockPrismaUser.findUnique.mockResolvedValue(testUser);
    });

    it('必要なロールを持つメンバーはアクセスできる', async () => {
      mockPrismaOrganizationMember.findUnique.mockResolvedValue({
        organizationId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        role: 'ADMIN',
        organization: { deletedAt: null },
      });

      const req = createMockRequest({
        user: testUser as any,
        params: { organizationId: TEST_ORG_ID },
      });
      const res = createMockResponse();
      const middleware = requireOrgRole(['ADMIN', 'OWNER']);

      await middleware(req as Request, res as Response, mockNext);

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
        user: testUser as any,
        params: { organizationId: TEST_ORG_ID },
      });
      const res = createMockResponse();
      const middleware = requireOrgRole(['ADMIN', 'OWNER']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect((mockNext as any).mock.calls[0][0].message).toBe(
        'Insufficient permissions'
      );
    });

    it('未認証ユーザーは拒否される', async () => {
      const req = createMockRequest({
        user: undefined,
        params: { organizationId: TEST_ORG_ID },
      });
      const res = createMockResponse();
      const middleware = requireOrgRole(['ADMIN']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      expect((mockNext as any).mock.calls[0][0].message).toBe('Not authenticated');
    });

    it('組織IDがない場合は拒否される', async () => {
      const req = createMockRequest({
        user: testUser as any,
        params: {},
      });
      const res = createMockResponse();
      const middleware = requireOrgRole(['ADMIN']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect((mockNext as any).mock.calls[0][0].message).toBe(
        'Organization ID required'
      );
    });

    it('メンバーでない場合は拒否される', async () => {
      mockPrismaOrganizationMember.findUnique.mockResolvedValue(null);

      const req = createMockRequest({
        user: testUser as any,
        params: { organizationId: TEST_ORG_ID },
      });
      const res = createMockResponse();
      const middleware = requireOrgRole(['ADMIN']);

      await middleware(req as Request, res as Response, mockNext);

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
        user: testUser as any,
        params: { organizationId: TEST_ORG_ID },
      });
      const res = createMockResponse();
      const middleware = requireOrgRole(['ADMIN']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect((mockNext as any).mock.calls[0][0].message).toBe(
        'Organization has been deleted'
      );
    });

    it('allowDeletedOrg: trueで削除済み組織へのアクセスを許可', async () => {
      mockPrismaOrganizationMember.findUnique.mockResolvedValue({
        organizationId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        role: 'ADMIN',
        organization: { deletedAt: new Date() },
      });

      const req = createMockRequest({
        user: testUser as any,
        params: { organizationId: TEST_ORG_ID },
      });
      const res = createMockResponse();
      const middleware = requireOrgRole(['ADMIN'], { allowDeletedOrg: true });

      await middleware(req as Request, res as Response, mockNext);

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
        user: testUser as any,
        params: {},
        body: { organizationId: TEST_ORG_ID },
      });
      const res = createMockResponse();
      const middleware = requireOrgRole(['ADMIN']);

      await middleware(req as Request, res as Response, mockNext);

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

  describe('requireProjectRole', () => {
    it('プロジェクトメンバーはアクセスできる', async () => {
      mockPrismaProject.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: null,
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'EDITOR' }],
      });

      const req = createMockRequest({
        user: testUser as any,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['EDITOR', 'VIEWER']);

      await middleware(req as Request, res as Response, mockNext);

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
        user: testUser as any,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      // VIEWERのみを要求しているが、OWNERなのでアクセス可能
      const middleware = requireProjectRole(['VIEWER']);

      await middleware(req as Request, res as Response, mockNext);

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
        user: testUser as any,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['EDITOR', 'OWNER']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('未認証ユーザーは拒否される', async () => {
      const req = createMockRequest({
        user: undefined,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['VIEWER']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('プロジェクトIDがない場合は拒否される', async () => {
      const req = createMockRequest({
        user: testUser as any,
        params: {},
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['VIEWER']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect((mockNext as any).mock.calls[0][0].message).toBe(
        'Project ID required'
      );
    });

    it('プロジェクトが見つからない場合は拒否される', async () => {
      mockPrismaProject.findUnique.mockResolvedValue(null);

      const req = createMockRequest({
        user: testUser as any,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['VIEWER']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect((mockNext as any).mock.calls[0][0].message).toBe('Project not found');
    });

    it('削除済みプロジェクトへのアクセスは拒否される', async () => {
      mockPrismaProject.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: new Date(),
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'EDITOR' }],
      });

      const req = createMockRequest({
        user: testUser as any,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['EDITOR']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect((mockNext as any).mock.calls[0][0].message).toBe(
        'Project has been deleted'
      );
    });

    it('allowDeletedProject: trueで削除済みプロジェクトへのアクセスを許可', async () => {
      mockPrismaProject.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        deletedAt: new Date(),
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'EDITOR' }],
      });

      const req = createMockRequest({
        user: testUser as any,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['EDITOR'], {
        allowDeletedProject: true,
      });

      await middleware(req as Request, res as Response, mockNext);

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
        user: testUser as any,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['EDITOR']);

      await middleware(req as Request, res as Response, mockNext);

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
        user: testUser as any,
        params: { projectId: TEST_PROJECT_ID },
      });
      const res = createMockResponse();
      const middleware = requireProjectRole(['EDITOR']);

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });
});
