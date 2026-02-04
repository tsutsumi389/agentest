import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// OrganizationService のモック
const mockOrgService = vi.hoisted(() => ({
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  restore: vi.fn(),
  getMembers: vi.fn(),
  invite: vi.fn(),
  getInvitationByToken: vi.fn(),
  acceptInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  getProjects: vi.fn(),
  getPendingInvitations: vi.fn(),
  cancelInvitation: vi.fn(),
  declineInvitation: vi.fn(),
  transferOwnership: vi.fn(),
}));

vi.mock('../../services/organization.service.js', () => ({
  OrganizationService: vi.fn().mockImplementation(() => mockOrgService),
}));

// AuditLogService のモック
const mockAuditLogService = vi.hoisted(() => ({
  getByOrganization: vi.fn(),
  getForExport: vi.fn(),
  formatAsCSV: vi.fn(),
  formatAsJSON: vi.fn(),
}));

vi.mock('../../services/audit-log.service.js', () => ({
  auditLogService: mockAuditLogService,
  AUDIT_LOG_DEFAULT_LIMIT: 20,
  AUDIT_LOG_MAX_LIMIT: 100,
}));

// @agentest/db のモック
vi.mock('@agentest/db', () => ({
  AuditLogCategory: {
    AUTH: 'AUTH',
    PROJECT: 'PROJECT',
    TEST_SUITE: 'TEST_SUITE',
    ORGANIZATION: 'ORGANIZATION',
  },
}));

// @agentest/shared のモック
vi.mock('@agentest/shared', () => ({
  auditLogExportSchema: {
    parse: vi.fn(),
  },
  generateTimestamp: vi.fn().mockReturnValue('20260115-120000'),
}));

import { OrganizationController } from '../../controllers/organization.controller.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const TEST_MEMBER_ID = '33333333-3333-3333-3333-333333333333';
const TEST_INVITATION_ID = '44444444-4444-4444-4444-444444444444';
const TEST_TOKEN = 'test-invitation-token';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID } as Request['user'],
  params: {},
  body: {},
  query: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
};

describe('OrganizationController（CRUD・メンバー・招待・プロジェクト・オーナー権限）', () => {
  let controller: OrganizationController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OrganizationController();
    mockNext = vi.fn();
  });

  // ==========================================================================
  // CRUD 操作
  // ==========================================================================

  describe('create', () => {
    it('組織を作成して201を返す', async () => {
      const mockOrg = { id: TEST_ORG_ID, name: 'テスト組織' };
      mockOrgService.create.mockResolvedValue(mockOrg);

      const req = mockRequest({
        body: { name: 'テスト組織' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.create(req, res, mockNext);

      expect(mockOrgService.create).toHaveBeenCalledWith(TEST_USER_ID, { name: 'テスト組織' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ organization: mockOrg });
    });

    it('descriptionを含めて組織を作成できる', async () => {
      const mockOrg = { id: TEST_ORG_ID, name: 'テスト組織', description: '説明文' };
      mockOrgService.create.mockResolvedValue(mockOrg);

      const req = mockRequest({
        body: { name: 'テスト組織', description: '説明文' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.create(req, res, mockNext);

      expect(mockOrgService.create).toHaveBeenCalledWith(TEST_USER_ID, {
        name: 'テスト組織',
        description: '説明文',
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('バリデーションエラー時にnextにエラーを渡す', async () => {
      // nameが空文字の場合バリデーションエラーになる
      const req = mockRequest({
        body: { name: '' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.create(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockOrgService.create).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('IDで組織を取得できる', async () => {
      const mockOrg = { id: TEST_ORG_ID, name: 'テスト組織' };
      mockOrgService.findById.mockResolvedValue(mockOrg);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockOrgService.findById).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(res.json).toHaveBeenCalledWith({ organization: mockOrg });
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('組織が見つかりません');
      mockOrgService.findById.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getById(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('update', () => {
    it('組織を更新できる', async () => {
      const mockOrg = { id: TEST_ORG_ID, name: '更新後の名前' };
      mockOrgService.update.mockResolvedValue(mockOrg);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
        body: { name: '更新後の名前' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.update(req, res, mockNext);

      expect(mockOrgService.update).toHaveBeenCalledWith(
        TEST_ORG_ID,
        { name: '更新後の名前' },
        TEST_USER_ID,
      );
      expect(res.json).toHaveBeenCalledWith({ organization: mockOrg });
    });

    it('billingEmailを含めて更新できる', async () => {
      const mockOrg = { id: TEST_ORG_ID, billingEmail: 'billing@example.com' };
      mockOrgService.update.mockResolvedValue(mockOrg);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
        body: { billingEmail: 'billing@example.com' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.update(req, res, mockNext);

      expect(mockOrgService.update).toHaveBeenCalledWith(
        TEST_ORG_ID,
        { billingEmail: 'billing@example.com' },
        TEST_USER_ID,
      );
      expect(res.json).toHaveBeenCalledWith({ organization: mockOrg });
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('更新権限がありません');
      mockOrgService.update.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
        body: { name: '更新後の名前' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.update(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('delete', () => {
    it('組織を論理削除して204を返す', async () => {
      mockOrgService.softDelete.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockOrgService.softDelete).toHaveBeenCalledWith(TEST_ORG_ID, TEST_USER_ID);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('削除権限がありません');
      mockOrgService.softDelete.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('restore', () => {
    it('削除された組織を復元できる', async () => {
      const mockOrg = { id: TEST_ORG_ID, name: 'テスト組織', deletedAt: null };
      mockOrgService.restore.mockResolvedValue(mockOrg);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.restore(req, res, mockNext);

      expect(mockOrgService.restore).toHaveBeenCalledWith(TEST_ORG_ID, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ organization: mockOrg });
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('復元に失敗しました');
      mockOrgService.restore.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.restore(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ==========================================================================
  // メンバー管理
  // ==========================================================================

  describe('getMembers', () => {
    it('組織のメンバー一覧を取得できる', async () => {
      const mockMembers = [
        { id: TEST_USER_ID, role: 'OWNER' },
        { id: TEST_MEMBER_ID, role: 'MEMBER' },
      ];
      mockOrgService.getMembers.mockResolvedValue(mockMembers);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getMembers(req, res, mockNext);

      expect(mockOrgService.getMembers).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(res.json).toHaveBeenCalledWith({ members: mockMembers });
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('メンバー取得に失敗しました');
      mockOrgService.getMembers.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getMembers(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('invite', () => {
    it('メンバーを招待して201を返す', async () => {
      const mockInvitation = {
        id: TEST_INVITATION_ID,
        email: 'invitee@example.com',
        role: 'MEMBER',
      };
      mockOrgService.invite.mockResolvedValue(mockInvitation);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
        body: { email: 'invitee@example.com', role: 'MEMBER' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.invite(req, res, mockNext);

      expect(mockOrgService.invite).toHaveBeenCalledWith(TEST_ORG_ID, TEST_USER_ID, {
        email: 'invitee@example.com',
        role: 'MEMBER',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ invitation: mockInvitation });
    });

    it('ロール未指定時はデフォルトでMEMBERになる', async () => {
      const mockInvitation = {
        id: TEST_INVITATION_ID,
        email: 'invitee@example.com',
        role: 'MEMBER',
      };
      mockOrgService.invite.mockResolvedValue(mockInvitation);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
        body: { email: 'invitee@example.com' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.invite(req, res, mockNext);

      // zodのdefault('MEMBER')により、role未指定でもMEMBERが設定される
      expect(mockOrgService.invite).toHaveBeenCalledWith(TEST_ORG_ID, TEST_USER_ID, {
        email: 'invitee@example.com',
        role: 'MEMBER',
      });
    });

    it('不正なメールアドレスの場合バリデーションエラーになる', async () => {
      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
        body: { email: 'invalid-email' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.invite(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockOrgService.invite).not.toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it('メンバーのロールを更新できる', async () => {
      const mockMember = { id: TEST_MEMBER_ID, role: 'ADMIN' };
      mockOrgService.updateMemberRole.mockResolvedValue(mockMember);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID, userId: TEST_MEMBER_ID },
        body: { role: 'ADMIN' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateMemberRole(req, res, mockNext);

      expect(mockOrgService.updateMemberRole).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_MEMBER_ID,
        'ADMIN',
        TEST_USER_ID,
      );
      expect(res.json).toHaveBeenCalledWith({ member: mockMember });
    });

    it('不正なロールの場合バリデーションエラーになる', async () => {
      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID, userId: TEST_MEMBER_ID },
        body: { role: 'INVALID_ROLE' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateMemberRole(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockOrgService.updateMemberRole).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('メンバーを削除して204を返す', async () => {
      mockOrgService.removeMember.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID, userId: TEST_MEMBER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.removeMember(req, res, mockNext);

      expect(mockOrgService.removeMember).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_MEMBER_ID,
        TEST_USER_ID,
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('メンバー削除に失敗しました');
      mockOrgService.removeMember.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID, userId: TEST_MEMBER_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.removeMember(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ==========================================================================
  // 招待管理
  // ==========================================================================

  describe('getInvitationByToken', () => {
    it('トークンで招待情報を取得できる', async () => {
      const mockInvitation = {
        id: TEST_INVITATION_ID,
        email: 'invitee@example.com',
        token: TEST_TOKEN,
      };
      mockOrgService.getInvitationByToken.mockResolvedValue(mockInvitation);

      const req = mockRequest({
        params: { token: TEST_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvitationByToken(req, res, mockNext);

      expect(mockOrgService.getInvitationByToken).toHaveBeenCalledWith(TEST_TOKEN);
      expect(res.json).toHaveBeenCalledWith({ invitation: mockInvitation });
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('招待が見つかりません');
      mockOrgService.getInvitationByToken.mockRejectedValue(error);

      const req = mockRequest({
        params: { token: TEST_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvitationByToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('acceptInvitation', () => {
    it('招待を承認してメンバー情報を返す', async () => {
      const mockMember = { id: TEST_MEMBER_ID, role: 'MEMBER' };
      mockOrgService.acceptInvitation.mockResolvedValue(mockMember);

      const req = mockRequest({
        params: { token: TEST_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.acceptInvitation(req, res, mockNext);

      expect(mockOrgService.acceptInvitation).toHaveBeenCalledWith(TEST_TOKEN, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ member: mockMember });
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('招待の承認に失敗しました');
      mockOrgService.acceptInvitation.mockRejectedValue(error);

      const req = mockRequest({
        params: { token: TEST_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.acceptInvitation(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getInvitations', () => {
    it('保留中の招待一覧を取得できる', async () => {
      const mockInvitations = [
        { id: TEST_INVITATION_ID, email: 'user1@example.com', status: 'PENDING' },
        { id: '55555555-5555-5555-5555-555555555555', email: 'user2@example.com', status: 'PENDING' },
      ];
      mockOrgService.getPendingInvitations.mockResolvedValue(mockInvitations);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvitations(req, res, mockNext);

      expect(mockOrgService.getPendingInvitations).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(res.json).toHaveBeenCalledWith({ invitations: mockInvitations });
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('招待一覧の取得に失敗しました');
      mockOrgService.getPendingInvitations.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getInvitations(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('cancelInvitation', () => {
    it('招待を取消して204を返す', async () => {
      mockOrgService.cancelInvitation.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID, invitationId: TEST_INVITATION_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.cancelInvitation(req, res, mockNext);

      expect(mockOrgService.cancelInvitation).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_INVITATION_ID,
        TEST_USER_ID,
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('招待の取消に失敗しました');
      mockOrgService.cancelInvitation.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID, invitationId: TEST_INVITATION_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.cancelInvitation(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('declineInvitation', () => {
    it('招待を辞退できる', async () => {
      const mockInvitation = {
        id: TEST_INVITATION_ID,
        status: 'DECLINED',
      };
      mockOrgService.declineInvitation.mockResolvedValue(mockInvitation);

      const req = mockRequest({
        params: { token: TEST_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.declineInvitation(req, res, mockNext);

      expect(mockOrgService.declineInvitation).toHaveBeenCalledWith(TEST_TOKEN, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ invitation: mockInvitation });
    });
  });

  // ==========================================================================
  // プロジェクト取得
  // ==========================================================================

  describe('getProjects', () => {
    it('組織のプロジェクト一覧を取得できる', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'プロジェクト1' },
        { id: 'proj-2', name: 'プロジェクト2' },
      ];
      mockOrgService.getProjects.mockResolvedValue(mockProjects);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getProjects(req, res, mockNext);

      expect(mockOrgService.getProjects).toHaveBeenCalledWith(TEST_ORG_ID);
      expect(res.json).toHaveBeenCalledWith({ projects: mockProjects });
    });

    it('サービスエラー時にnextにエラーを渡す', async () => {
      const error = new Error('プロジェクト取得に失敗しました');
      mockOrgService.getProjects.mockRejectedValue(error);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getProjects(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ==========================================================================
  // オーナー権限移譲
  // ==========================================================================

  describe('transferOwnership', () => {
    it('オーナー権限を移譲できる', async () => {
      const newOwnerId = '55555555-5555-5555-5555-555555555555';
      const mockMember = { id: newOwnerId, role: 'OWNER' };
      mockOrgService.transferOwnership.mockResolvedValue(mockMember);

      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
        body: { newOwnerId },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.transferOwnership(req, res, mockNext);

      expect(mockOrgService.transferOwnership).toHaveBeenCalledWith(
        TEST_ORG_ID,
        TEST_USER_ID,
        newOwnerId,
      );
      expect(res.json).toHaveBeenCalledWith({ member: mockMember });
    });

    it('不正なUUID形式の場合バリデーションエラーになる', async () => {
      const req = mockRequest({
        params: { organizationId: TEST_ORG_ID },
        body: { newOwnerId: 'not-a-uuid' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.transferOwnership(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockOrgService.transferOwnership).not.toHaveBeenCalled();
    });
  });
});
