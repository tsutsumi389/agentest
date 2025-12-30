import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError, NotFoundError, BadRequestError } from '@agentest/shared';

// prismaのモック（vi.hoistedを使用してホイスト問題を回避）
const mockPrisma = vi.hoisted(() => ({
  execution: {
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
import { requireExecutionRole } from '../../middleware/require-execution-role.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXECUTION_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PROJECT_ID = '44444444-4444-4444-4444-444444444444';
const TEST_ORG_ID = '55555555-5555-5555-5555-555555555555';

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    user: { id: TEST_USER_ID },
    params: { executionId: TEST_EXECUTION_ID },
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

// 標準的な実行データを作成するヘルパー
function createMockExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_EXECUTION_ID,
    status: 'IN_PROGRESS',
    testSuite: {
      id: TEST_SUITE_ID,
      deletedAt: null,
      project: {
        id: TEST_PROJECT_ID,
        deletedAt: null,
        organizationId: null,
        members: [{ userId: TEST_USER_ID, role: 'OWNER' }],
      },
    },
    ...overrides,
  };
}

describe('requireExecutionRole', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('認証チェック', () => {
    it('req.userがない場合はAuthenticationErrorを投げる', async () => {
      const req = createMockRequest({ user: undefined });
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Not authenticated');
    });
  });

  describe('パラメータチェック', () => {
    it('executionIdがない場合はAuthorizationErrorを投げる', async () => {
      const req = createMockRequest({ params: {} });
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Execution ID required');
    });

    it('無効なUUID形式のexecutionIdでBadRequestErrorを投げる', async () => {
      const req = createMockRequest({ params: { executionId: 'invalid-uuid' } });
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Invalid execution ID format');
    });
  });

  describe('実行存在チェック', () => {
    it('実行が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });
  });

  describe('実行ステータスチェック', () => {
    it('完了済み実行はデフォルトで通過する（allowCompletedExecution: true）', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({ status: 'COMPLETED' })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });

    it('完了済み実行でallowCompletedExecution: falseならAuthorizationErrorを投げる', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({ status: 'COMPLETED' })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ'], { allowCompletedExecution: false });
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Execution is not in progress');
    });

    it('中止済み実行でallowCompletedExecution: falseならAuthorizationErrorを投げる', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({ status: 'ABORTED' })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ'], { allowCompletedExecution: false });
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('進行中の実行はallowCompletedExecution: falseでも通過する', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({ status: 'IN_PROGRESS' })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ'], { allowCompletedExecution: false });
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });
  });

  describe('テストスイート削除チェック', () => {
    it('削除済みテストスイートはAuthorizationErrorを投げる', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: new Date(),
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: null,
              members: [{ userId: TEST_USER_ID, role: 'OWNER' }],
            },
          },
        })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Test suite has been deleted');
    });
  });

  describe('プロジェクト削除チェック', () => {
    it('削除済みプロジェクトはAuthorizationErrorを投げる', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: new Date(),
              organizationId: null,
              members: [{ userId: TEST_USER_ID, role: 'OWNER' }],
            },
          },
        })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Project has been deleted');
    });
  });

  describe('プロジェクトオーナー権限', () => {
    it('プロジェクトオーナーは全権限を持つ', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(createMockExecution());

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['ADMIN']); // ADMIN権限が必要
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
      expect(req.params?.projectId).toBe(TEST_PROJECT_ID);
      expect(req.params?.testSuiteId).toBe(TEST_SUITE_ID);
    });
  });

  describe('プロジェクトメンバー権限', () => {
    it('必要なロールを持つメンバーは通過する', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: null,
              members: [{ userId: TEST_USER_ID, role: 'WRITE' }],
            },
          },
        })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['WRITE', 'ADMIN']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
      expect(req.params?.projectId).toBe(TEST_PROJECT_ID);
      expect(req.params?.testSuiteId).toBe(TEST_SUITE_ID);
    });

    it('必要なロールを持たないメンバーはAuthorizationErrorを投げる', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: null,
              members: [{ userId: TEST_USER_ID, role: 'READ' }],
            },
          },
        })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['ADMIN']); // ADMIN必須
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('Insufficient permissions');
    });

    it('VIEWERロール（READ）で書き込み操作を拒否', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: null,
              members: [{ userId: TEST_USER_ID, role: 'READ' }],
            },
          },
        })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['OWNER', 'ADMIN', 'WRITE']); // 書き込み権限
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('メンバーでないユーザーはAuthorizationErrorを投げる', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: null,
              members: [],
            },
          },
        })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('組織メンバー権限フォールバック', () => {
    it('プロジェクトメンバーでなくても組織OWNER/ADMINなら通過する', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: TEST_ORG_ID,
              members: [],
            },
          },
        })
      );
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role: 'ADMIN',
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['WRITE']);
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
      expect(req.params?.testSuiteId).toBe(TEST_SUITE_ID);
    });

    it('組織OWNERも通過する', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: TEST_ORG_ID,
              members: [],
            },
          },
        })
      );
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role: 'OWNER',
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });

    it('組織MEMBERはフォールバックでは通過しない', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: TEST_ORG_ID,
              members: [],
            },
          },
        })
      );
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role: 'MEMBER',
      });

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('組織メンバーでもない場合はAuthorizationErrorを投げる', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: TEST_ORG_ID,
              members: [],
            },
          },
        })
      );
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
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
      mockPrisma.execution.findUnique.mockResolvedValue(
        createMockExecution({
          testSuite: {
            id: TEST_SUITE_ID,
            deletedAt: null,
            project: {
              id: TEST_PROJECT_ID,
              deletedAt: null,
              organizationId: null,
              members: [{ userId: TEST_USER_ID, role: memberRole }],
            },
          },
        })
      );

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(allowedRoles as any);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(); // エラーなし
    });
  });

  describe('エラーハンドリング', () => {
    it('prismaエラーはnextに渡される', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.execution.findUnique.mockRejectedValue(dbError);

      const req = createMockRequest();
      const res = createMockResponse();

      const middleware = requireExecutionRole(['READ']);
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });
  });
});
