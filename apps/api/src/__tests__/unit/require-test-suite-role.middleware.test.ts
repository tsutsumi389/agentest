import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@agentest/shared';

// prismaのモック（vi.hoistedを使用してホイスト問題を回避）
const mockPrisma = vi.hoisted(() => ({
  testSuite: {
    findUnique: vi.fn(),
  },
  organizationMember: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// モック設定後にインポート
import { requireTestSuiteRole } from '../../middleware/require-test-suite-role.js';

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    user: { id: 'user-1' },
    params: { testSuiteId: 'test-suite-1' },
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('requireTestSuiteRole', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('認証チェック', () => {
    it('req.userがない場合はAuthenticationErrorを投げる', async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Not authenticated');
    });
  });

  describe('パラメータチェック', () => {
    it('testSuiteIdがない場合はAuthorizationErrorを投げる', async () => {
      const req = createMockRequest({ params: {} });
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Test suite ID required');
    });
  });

  describe('テストスイート存在チェック', () => {
    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('削除済みテストスイートはNotFoundErrorを投げる（allowDeletedSuite: false）', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: new Date(),
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: null,
          members: [],
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('削除済みテストスイートでもallowDeletedSuite: trueなら通過する', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: new Date(),
        project: {
          id: 'project-1',
          ownerId: 'user-1', // オーナー
          deletedAt: null,
          organizationId: null,
          members: [],
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ'], { allowDeletedSuite: true });
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });
  });

  describe('プロジェクト削除チェック', () => {
    it('削除済みプロジェクトはAuthorizationErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'user-1',
          deletedAt: new Date(), // 削除済み
          organizationId: null,
          members: [],
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Project has been deleted');
    });
  });

  describe('プロジェクトオーナー権限', () => {
    it('プロジェクトオーナーは全権限を持つ', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'user-1', // リクエストユーザーがオーナー
          deletedAt: null,
          organizationId: null,
          members: [],
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['ADMIN']); // ADMIN権限が必要
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
      expect(req.params?.projectId).toBe('project-1');
    });
  });

  describe('プロジェクトメンバー権限', () => {
    it('必要なロールを持つメンバーは通過する', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: null,
          members: [{ userId: 'user-1', role: 'WRITE' }],
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['WRITE', 'ADMIN']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
      expect(req.params?.projectId).toBe('project-1');
    });

    it('必要なロールを持たないメンバーはAuthorizationErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: null,
          members: [{ userId: 'user-1', role: 'READ' }], // READのみ
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['ADMIN']); // ADMIN必須
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Insufficient permissions');
    });

    it('メンバーでないユーザーはAuthorizationErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: null,
          members: [], // メンバーではない
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('組織メンバー権限フォールバック', () => {
    it('プロジェクトメンバーでなくても組織OWNER/ADMINなら通過する', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: 'org-1',
          members: [], // プロジェクトメンバーではない
        },
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'ADMIN', // 組織ADMIN
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['WRITE']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-1',
            userId: 'user-1',
          },
        },
      });
      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
      expect(req.params?.projectId).toBe('project-1');
    });

    it('組織OWNERも通過する', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: 'org-1',
          members: [],
        },
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'OWNER', // 組織OWNER
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });

    it('組織MEMBERはフォールバックでは通過しない', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: 'org-1',
          members: [],
        },
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'MEMBER', // 組織MEMBER（OWNER/ADMINではない）
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('組織メンバーでもない場合はAuthorizationErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: 'org-1',
          members: [],
        },
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null); // 組織メンバーでもない

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('複数ロールの許可', () => {
    it.each([
      ['ADMIN', ['ADMIN', 'WRITE', 'READ']],
      ['WRITE', ['ADMIN', 'WRITE', 'READ']],
      ['READ', ['ADMIN', 'WRITE', 'READ']],
      ['ADMIN', ['ADMIN']],
      ['WRITE', ['WRITE']],
    ])('ロール %s は許可ロール %j に含まれる場合通過する', async (memberRole, allowedRoles) => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: 'test-suite-1',
        deletedAt: null,
        project: {
          id: 'project-1',
          ownerId: 'other-user',
          deletedAt: null,
          organizationId: null,
          members: [{ userId: 'user-1', role: memberRole }],
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(allowedRoles as any);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });
  });

  describe('エラーハンドリング', () => {
    it('prismaエラーはnextに渡される', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.testSuite.findUnique.mockRejectedValue(dbError);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
