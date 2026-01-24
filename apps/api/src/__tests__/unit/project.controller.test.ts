import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ProjectController } from '../../controllers/project.controller.js';
import { NotFoundError } from '@agentest/shared';

// ProjectService のモック
const mockProjectService = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  getMembers: vi.fn(),
  addMember: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  getEnvironments: vi.fn(),
  createEnvironment: vi.fn(),
  updateEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
  reorderEnvironments: vi.fn(),
  searchTestSuites: vi.fn(),
  suggestTestSuites: vi.fn(),
  getHistories: vi.fn(),
  restore: vi.fn(),
};

vi.mock('../../services/project.service.js', () => ({
  ProjectService: vi.fn().mockImplementation(() => mockProjectService),
}));

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_ENV_ID = '33333333-3333-3333-3333-333333333333';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
  params: { projectId: TEST_PROJECT_ID },
  body: {},
  query: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ProjectController();
    mockNext = vi.fn();
  });

  describe('create', () => {
    it('プロジェクトを作成できる', async () => {
      const mockProject = { id: TEST_PROJECT_ID, name: 'New Project' };
      mockProjectService.create.mockResolvedValue(mockProject);

      const req = mockRequest({
        body: { name: 'New Project' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.create(req, res, mockNext);

      expect(mockProjectService.create).toHaveBeenCalledWith(TEST_USER_ID, { name: 'New Project' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ project: mockProject });
    });
  });

  describe('getById', () => {
    it('プロジェクト詳細を取得できる', async () => {
      const mockProject = { id: TEST_PROJECT_ID, name: 'Test Project' };
      mockProjectService.findById.mockResolvedValue(mockProject);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockProjectService.findById).toHaveBeenCalledWith(TEST_PROJECT_ID);
      expect(res.json).toHaveBeenCalledWith({ project: mockProject });
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('Project', TEST_PROJECT_ID);
      mockProjectService.findById.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('update', () => {
    it('プロジェクトを更新できる', async () => {
      const mockProject = { id: TEST_PROJECT_ID, name: 'Updated Project' };
      mockProjectService.update.mockResolvedValue(mockProject);

      const req = mockRequest({
        body: { name: 'Updated Project' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.update(req, res, mockNext);

      expect(mockProjectService.update).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        { name: 'Updated Project' },
        TEST_USER_ID
      );
      expect(res.json).toHaveBeenCalledWith({ project: mockProject });
    });
  });

  describe('delete', () => {
    it('プロジェクトを削除できる', async () => {
      mockProjectService.softDelete.mockResolvedValue(undefined);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockProjectService.softDelete).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_ID);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getMembers', () => {
    it('メンバー一覧を取得できる', async () => {
      const mockMembers = [{ userId: TEST_USER_ID, role: 'OWNER' }];
      mockProjectService.getMembers.mockResolvedValue(mockMembers);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getMembers(req, res, mockNext);

      expect(mockProjectService.getMembers).toHaveBeenCalledWith(TEST_PROJECT_ID);
      expect(res.json).toHaveBeenCalledWith({ members: mockMembers });
    });
  });

  describe('addMember', () => {
    it('メンバーを追加できる', async () => {
      const newUserId = '44444444-4444-4444-4444-444444444444';
      const mockMember = { userId: newUserId, role: 'READ' };
      mockProjectService.addMember.mockResolvedValue(mockMember);

      const req = mockRequest({
        body: { userId: newUserId, role: 'READ' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.addMember(req, res, mockNext);

      expect(mockProjectService.addMember).toHaveBeenCalledWith(TEST_PROJECT_ID, newUserId, 'READ', TEST_USER_ID);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ member: mockMember });
    });
  });

  describe('updateMemberRole', () => {
    it('メンバーロールを更新できる', async () => {
      const targetUserId = '44444444-4444-4444-4444-444444444444';
      const mockMember = { userId: targetUserId, role: 'WRITE' };
      mockProjectService.updateMemberRole.mockResolvedValue(mockMember);

      const req = mockRequest({
        params: { projectId: TEST_PROJECT_ID, userId: targetUserId },
        body: { role: 'WRITE' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateMemberRole(req, res, mockNext);

      expect(mockProjectService.updateMemberRole).toHaveBeenCalledWith(TEST_PROJECT_ID, targetUserId, 'WRITE');
      expect(res.json).toHaveBeenCalledWith({ member: mockMember });
    });
  });

  describe('removeMember', () => {
    it('メンバーを削除できる', async () => {
      const targetUserId = '44444444-4444-4444-4444-444444444444';
      mockProjectService.removeMember.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { projectId: TEST_PROJECT_ID, userId: targetUserId },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.removeMember(req, res, mockNext);

      expect(mockProjectService.removeMember).toHaveBeenCalledWith(TEST_PROJECT_ID, targetUserId);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('getEnvironments', () => {
    it('環境一覧を取得できる', async () => {
      const mockEnvs = [{ id: TEST_ENV_ID, name: 'Development' }];
      mockProjectService.getEnvironments.mockResolvedValue(mockEnvs);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getEnvironments(req, res, mockNext);

      expect(mockProjectService.getEnvironments).toHaveBeenCalledWith(TEST_PROJECT_ID);
      expect(res.json).toHaveBeenCalledWith({ environments: mockEnvs });
    });
  });

  describe('createEnvironment', () => {
    it('環境を作成できる', async () => {
      const mockEnv = { id: TEST_ENV_ID, name: 'Production' };
      mockProjectService.createEnvironment.mockResolvedValue(mockEnv);

      const req = mockRequest({
        body: { name: 'Production', slug: 'prod' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.createEnvironment(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ environment: mockEnv });
    });
  });

  describe('updateEnvironment', () => {
    it('環境を更新できる', async () => {
      const mockEnv = { id: TEST_ENV_ID, name: 'Updated' };
      mockProjectService.updateEnvironment.mockResolvedValue(mockEnv);

      const req = mockRequest({
        params: { projectId: TEST_PROJECT_ID, environmentId: TEST_ENV_ID },
        body: { name: 'Updated' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateEnvironment(req, res, mockNext);

      expect(mockProjectService.updateEnvironment).toHaveBeenCalledWith(
        TEST_PROJECT_ID,
        TEST_ENV_ID,
        { name: 'Updated' }
      );
      expect(res.json).toHaveBeenCalledWith({ environment: mockEnv });
    });
  });

  describe('deleteEnvironment', () => {
    it('環境を削除できる', async () => {
      mockProjectService.deleteEnvironment.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { projectId: TEST_PROJECT_ID, environmentId: TEST_ENV_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteEnvironment(req, res, mockNext);

      expect(mockProjectService.deleteEnvironment).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_ENV_ID);
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });

  describe('reorderEnvironments', () => {
    it('環境を並び替えできる', async () => {
      const envIds = [
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
      ];
      const mockEnvs = envIds.map((id, i) => ({ id, order: i }));
      mockProjectService.reorderEnvironments.mockResolvedValue(mockEnvs);

      const req = mockRequest({
        body: { environmentIds: envIds },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.reorderEnvironments(req, res, mockNext);

      expect(mockProjectService.reorderEnvironments).toHaveBeenCalledWith(TEST_PROJECT_ID, envIds);
      expect(res.json).toHaveBeenCalledWith({ environments: mockEnvs });
    });
  });

  describe('getTestSuites', () => {
    it('テストスイート一覧を検索できる', async () => {
      const mockResult = {
        items: [
          {
            id: 'suite-1',
            name: 'Test Suite',
            testSuiteLabels: [
              { label: { id: 'label-1', name: 'Label 1', color: '#ff0000' } },
            ],
            executions: [
              {
                id: 'exec-1',
                createdAt: new Date(),
                environment: { id: 'env-1', name: 'Production' },
                expectedResults: [
                  { status: 'PASS' },
                  { status: 'FAIL' },
                ],
              },
            ],
          },
        ],
        total: 1,
      };
      mockProjectService.searchTestSuites.mockResolvedValue(mockResult);

      const req = mockRequest({
        query: { q: 'test', limit: '10', offset: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getTestSuites(req, res, mockNext);

      expect(mockProjectService.searchTestSuites).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          testSuites: [
            expect.objectContaining({
              id: 'suite-1',
              name: 'Test Suite',
              labels: [{ id: 'label-1', name: 'Label 1', color: '#ff0000' }],
              lastExecution: expect.objectContaining({
                id: 'exec-1',
                environment: { id: 'env-1', name: 'Production' },
                judgmentCounts: { PASS: 1, FAIL: 1, PENDING: 0, SKIPPED: 0 },
              }),
            }),
          ],
          total: 1,
        })
      );
    });
  });

  describe('suggestTestSuites', () => {
    it('サジェストを取得できる', async () => {
      const mockSuggestions = [{ id: 'suite-1', name: 'Test' }];
      mockProjectService.suggestTestSuites.mockResolvedValue(mockSuggestions);

      const req = mockRequest({
        query: { q: 'test' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.suggestTestSuites(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ suggestions: mockSuggestions });
    });
  });

  describe('getHistories', () => {
    it('履歴一覧を取得できる', async () => {
      const mockHistories = { histories: [{ id: 'history-1' }], total: 1 };
      mockProjectService.getHistories.mockResolvedValue(mockHistories);

      const req = mockRequest({
        query: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getHistories(req, res, mockNext);

      expect(mockProjectService.getHistories).toHaveBeenCalledWith(TEST_PROJECT_ID, {
        limit: undefined,
        offset: undefined,
      });
      expect(res.json).toHaveBeenCalledWith(mockHistories);
    });

    it('limit/offsetのバリデーション（不正なlimit）', async () => {
      const req = mockRequest({
        query: { limit: 'invalid' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getHistories(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'limit は 1〜100 の整数である必要があります',
      });
    });

    it('limit/offsetのバリデーション（不正なoffset）', async () => {
      const req = mockRequest({
        query: { offset: '-1' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getHistories(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'offset は 0 以上の整数である必要があります',
      });
    });
  });

  describe('restore', () => {
    it('削除済みプロジェクトを復元できる', async () => {
      const mockProject = { id: TEST_PROJECT_ID, deletedAt: null };
      mockProjectService.restore.mockResolvedValue(mockProject);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.restore(req, res, mockNext);

      expect(mockProjectService.restore).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ project: mockProject });
    });
  });
});
