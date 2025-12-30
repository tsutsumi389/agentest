import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { UserController } from '../../controllers/user.controller.js';
import { AuthorizationError, NotFoundError } from '@agentest/shared';

// UserService のモック
const mockUserService = {
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  getOrganizations: vi.fn(),
  getProjects: vi.fn(),
  countProjects: vi.fn(),
};

vi.mock('../../services/user.service.js', () => ({
  UserService: vi.fn().mockImplementation(() => mockUserService),
}));

// AccountService のモック
const mockAccountService = {
  getAccounts: vi.fn(),
  unlinkAccount: vi.fn(),
};

vi.mock('../../services/account.service.js', () => ({
  AccountService: vi.fn().mockImplementation(() => mockAccountService),
}));

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
  params: { userId: TEST_USER_ID },
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

describe('UserController', () => {
  let controller: UserController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UserController();
    mockNext = vi.fn();
  });

  describe('getUser', () => {
    it('ユーザー詳細を取得できる', async () => {
      const mockUser = {
        id: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
      };
      mockUserService.findById.mockResolvedValue(mockUser);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getUser(req, res, mockNext);

      expect(mockUserService.findById).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ user: mockUser });
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('User', TEST_USER_ID);
      mockUserService.findById.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getUser(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateUser', () => {
    it('自分のプロフィールを更新できる', async () => {
      const mockUser = {
        id: TEST_USER_ID,
        name: 'Updated Name',
      };
      mockUserService.update.mockResolvedValue(mockUser);

      const req = mockRequest({
        body: { name: 'Updated Name' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateUser(req, res, mockNext);

      expect(mockUserService.update).toHaveBeenCalledWith(TEST_USER_ID, { name: 'Updated Name' });
      expect(res.json).toHaveBeenCalledWith({ user: mockUser });
    });

    it('他人のプロフィール更新はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateUser(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(mockUserService.update).not.toHaveBeenCalled();
    });

    it('avatarUrlを更新できる', async () => {
      const mockUser = {
        id: TEST_USER_ID,
        avatarUrl: 'https://example.com/avatar.png',
      };
      mockUserService.update.mockResolvedValue(mockUser);

      const req = mockRequest({
        body: { avatarUrl: 'https://example.com/avatar.png' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateUser(req, res, mockNext);

      expect(mockUserService.update).toHaveBeenCalledWith(TEST_USER_ID, {
        avatarUrl: 'https://example.com/avatar.png',
      });
    });

    it('avatarUrlをnullに設定できる', async () => {
      mockUserService.update.mockResolvedValue({ id: TEST_USER_ID, avatarUrl: null });

      const req = mockRequest({
        body: { avatarUrl: null },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateUser(req, res, mockNext);

      expect(mockUserService.update).toHaveBeenCalledWith(TEST_USER_ID, { avatarUrl: null });
    });
  });

  describe('deleteUser', () => {
    it('自分のアカウントを削除できる', async () => {
      mockUserService.softDelete.mockResolvedValue(undefined);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.deleteUser(req, res, mockNext);

      expect(mockUserService.softDelete).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('他人のアカウント削除はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteUser(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(mockUserService.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('getUserOrganizations', () => {
    it('自分の組織一覧を取得できる', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'Organization 1' },
        { id: 'org-2', name: 'Organization 2' },
      ];
      mockUserService.getOrganizations.mockResolvedValue(mockOrgs);

      const req = mockRequest({
        query: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserOrganizations(req, res, mockNext);

      expect(mockUserService.getOrganizations).toHaveBeenCalledWith(TEST_USER_ID, {
        includeDeleted: false,
      });
      expect(res.json).toHaveBeenCalledWith({ organizations: mockOrgs });
    });

    it('includeDeletedオプションが機能する', async () => {
      mockUserService.getOrganizations.mockResolvedValue([]);

      const req = mockRequest({
        query: { includeDeleted: 'true' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserOrganizations(req, res, mockNext);

      expect(mockUserService.getOrganizations).toHaveBeenCalledWith(TEST_USER_ID, {
        includeDeleted: true,
      });
    });

    it('他人の組織一覧はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserOrganizations(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('getUserProjects', () => {
    it('自分のプロジェクト一覧を取得できる', async () => {
      const mockProjects = [{ id: 'project-1', name: 'Project 1' }];
      mockUserService.getProjects.mockResolvedValue(mockProjects);
      mockUserService.countProjects.mockResolvedValue(1);

      const req = mockRequest({
        query: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserProjects(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        projects: mockProjects,
        pagination: {
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      });
    });

    it('qで名前検索できる', async () => {
      mockUserService.getProjects.mockResolvedValue([]);
      mockUserService.countProjects.mockResolvedValue(0);

      const req = mockRequest({
        query: { q: 'search term' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserProjects(req, res, mockNext);

      expect(mockUserService.getProjects).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({ q: 'search term' })
      );
    });

    it('organizationIdでフィルタできる', async () => {
      mockUserService.getProjects.mockResolvedValue([]);
      mockUserService.countProjects.mockResolvedValue(0);

      const req = mockRequest({
        query: { organizationId: 'org-1' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserProjects(req, res, mockNext);

      expect(mockUserService.getProjects).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({ organizationId: 'org-1' })
      );
    });

    it('"null"で個人プロジェクトのみ取得', async () => {
      mockUserService.getProjects.mockResolvedValue([]);
      mockUserService.countProjects.mockResolvedValue(0);

      const req = mockRequest({
        query: { organizationId: 'null' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserProjects(req, res, mockNext);

      expect(mockUserService.getProjects).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({ organizationId: null })
      );
    });

    it('pagination情報を返す', async () => {
      const mockProjects = Array(10).fill({ id: 'project', name: 'Project' });
      mockUserService.getProjects.mockResolvedValue(mockProjects);
      mockUserService.countProjects.mockResolvedValue(25);

      const req = mockRequest({
        query: { limit: '10', offset: '10' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserProjects(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        projects: mockProjects,
        pagination: {
          total: 25,
          limit: 10,
          offset: 10,
          hasMore: true,
        },
      });
    });

    it('他人のプロジェクト一覧はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getUserProjects(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('getAccounts', () => {
    it('OAuth連携一覧を取得できる', async () => {
      const mockAccounts = [
        { id: 'account-1', provider: 'github' },
        { id: 'account-2', provider: 'google' },
      ];
      mockAccountService.getAccounts.mockResolvedValue(mockAccounts);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getAccounts(req, res, mockNext);

      expect(mockAccountService.getAccounts).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ data: mockAccounts });
    });

    it('他人の連携一覧はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAccounts(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('unlinkAccount', () => {
    it('OAuth連携を解除できる', async () => {
      const mockResult = { success: true };
      mockAccountService.unlinkAccount.mockResolvedValue(mockResult);

      const req = mockRequest({
        params: { userId: TEST_USER_ID, provider: 'github' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.unlinkAccount(req, res, mockNext);

      expect(mockAccountService.unlinkAccount).toHaveBeenCalledWith(TEST_USER_ID, 'github');
      expect(res.json).toHaveBeenCalledWith({ data: mockResult });
    });

    it('他人の連携解除はAuthorizationError', async () => {
      const req = mockRequest({
        params: { userId: OTHER_USER_ID, provider: 'github' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.unlinkAccount(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(mockAccountService.unlinkAccount).not.toHaveBeenCalled();
    });
  });
});
