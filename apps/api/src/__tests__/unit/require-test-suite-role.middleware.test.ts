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

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_PROJECT_ID = '33333333-3333-3333-3333-333333333333';
const TEST_ORG_ID = '44444444-4444-4444-4444-444444444444';
const OTHER_USER_ID = '55555555-5555-5555-5555-555555555555';

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    user: { id: TEST_USER_ID },
    params: { testSuiteId: TEST_SUITE_ID },
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
        id: TEST_SUITE_ID,
        deletedAt: new Date(),
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
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
        id: TEST_SUITE_ID,
        deletedAt: new Date(),
        project: {
          id: TEST_PROJECT_ID,
          ownerId: TEST_USER_ID, // オーナー
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
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: TEST_USER_ID,
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
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: TEST_USER_ID, // リクエストユーザーがオーナー
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
      expect(req.params?.projectId).toBe(TEST_PROJECT_ID);
    });
  });

  describe('プロジェクトメンバー権限', () => {
    it('必要なロールを持つメンバーは通過する', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
          deletedAt: null,
          organizationId: null,
          members: [{ userId: TEST_USER_ID, role: 'WRITE' }],
        },
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['WRITE', 'ADMIN']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
      expect(req.params?.projectId).toBe(TEST_PROJECT_ID);
    });

    it('必要なロールを持たないメンバーはAuthorizationErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
          deletedAt: null,
          organizationId: null,
          members: [{ userId: TEST_USER_ID, role: 'READ' }], // READのみ
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
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
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
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
          deletedAt: null,
          organizationId: TEST_ORG_ID,
          members: [], // プロジェクトメンバーではない
        },
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role: 'ADMIN', // 組織ADMIN
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireTestSuiteRole(['WRITE']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
          },
        },
      });
      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
      expect(req.params?.projectId).toBe(TEST_PROJECT_ID);
    });

    it('組織OWNERも通過する', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
          deletedAt: null,
          organizationId: TEST_ORG_ID,
          members: [],
        },
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
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
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
          deletedAt: null,
          organizationId: TEST_ORG_ID,
          members: [],
        },
      });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
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
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
          deletedAt: null,
          organizationId: TEST_ORG_ID,
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
        id: TEST_SUITE_ID,
        deletedAt: null,
        project: {
          id: TEST_PROJECT_ID,
          ownerId: OTHER_USER_ID,
          deletedAt: null,
          organizationId: null,
          members: [{ userId: TEST_USER_ID, role: memberRole }],
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
