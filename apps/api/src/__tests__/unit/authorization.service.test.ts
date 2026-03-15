import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prismaモック
const mockPrisma = vi.hoisted(() => ({
  projectMember: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  organizationMember: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

import { AuthorizationService } from '../../services/authorization.service.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_ORG_ID = '33333333-3333-3333-3333-333333333333';

describe('AuthorizationService', () => {
  let service: AuthorizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthorizationService();
  });

  describe('checkProjectRole', () => {
    describe('プロジェクト直接メンバーシップ', () => {
      it('必要なロールを持つメンバーはtrueを返す', async () => {
        mockPrisma.projectMember.findUnique.mockResolvedValue({
          userId: TEST_USER_ID,
          projectId: TEST_PROJECT_ID,
          role: 'WRITE',
        });

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, [
          'WRITE',
          'ADMIN',
        ]);

        expect(result).toBe(true);
        expect(mockPrisma.projectMember.findUnique).toHaveBeenCalledWith({
          where: {
            projectId_userId: { projectId: TEST_PROJECT_ID, userId: TEST_USER_ID },
          },
        });
        // プロジェクト・組織チェックは不要
        expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
      });

      it('OWNERロールはrequiredRolesに関係なくtrueを返す', async () => {
        mockPrisma.projectMember.findUnique.mockResolvedValue({
          userId: TEST_USER_ID,
          projectId: TEST_PROJECT_ID,
          role: 'OWNER',
        });

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, ['ADMIN']);

        expect(result).toBe(true);
        expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
      });

      it('必要なロールを持たないメンバーは組織チェックに進む', async () => {
        mockPrisma.projectMember.findUnique.mockResolvedValue({
          userId: TEST_USER_ID,
          projectId: TEST_PROJECT_ID,
          role: 'READ',
        });
        mockPrisma.project.findUnique.mockResolvedValue({
          organizationId: null,
        });

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, ['ADMIN']);

        expect(result).toBe(false);
        expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
          where: { id: TEST_PROJECT_ID },
          select: { organizationId: true },
        });
      });
    });

    describe('組織メンバー経由のアクセス', () => {
      beforeEach(() => {
        // プロジェクト直接メンバーではない
        mockPrisma.projectMember.findUnique.mockResolvedValue(null);
        // プロジェクトは組織に所属
        mockPrisma.project.findUnique.mockResolvedValue({
          organizationId: TEST_ORG_ID,
        });
      });

      it('組織OWNERはtrueを返す', async () => {
        mockPrisma.organizationMember.findUnique.mockResolvedValue({
          userId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
          role: 'OWNER',
        });

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, ['READ']);

        expect(result).toBe(true);
        expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledWith({
          where: {
            organizationId_userId: {
              organizationId: TEST_ORG_ID,
              userId: TEST_USER_ID,
            },
          },
        });
      });

      it('組織ADMINはtrueを返す', async () => {
        mockPrisma.organizationMember.findUnique.mockResolvedValue({
          userId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
          role: 'ADMIN',
        });

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, ['READ']);

        expect(result).toBe(true);
      });

      it('組織MEMBERはfalseを返す', async () => {
        mockPrisma.organizationMember.findUnique.mockResolvedValue({
          userId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
          role: 'MEMBER',
        });

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, ['READ']);

        expect(result).toBe(false);
      });

      it('組織メンバーでない場合はfalseを返す', async () => {
        mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, ['READ']);

        expect(result).toBe(false);
      });
    });

    describe('プロジェクトが組織に所属しない場合', () => {
      it('非メンバーかつ組織なしの場合はfalseを返す', async () => {
        mockPrisma.projectMember.findUnique.mockResolvedValue(null);
        mockPrisma.project.findUnique.mockResolvedValue({
          organizationId: null,
        });

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, ['READ']);

        expect(result).toBe(false);
        expect(mockPrisma.organizationMember.findUnique).not.toHaveBeenCalled();
      });
    });

    describe('プロジェクトが存在しない場合', () => {
      it('プロジェクト不在の場合はfalseを返す', async () => {
        mockPrisma.projectMember.findUnique.mockResolvedValue(null);
        mockPrisma.project.findUnique.mockResolvedValue(null);

        const result = await service.checkProjectRole(TEST_USER_ID, TEST_PROJECT_ID, ['READ']);

        expect(result).toBe(false);
        expect(mockPrisma.organizationMember.findUnique).not.toHaveBeenCalled();
      });
    });
  });
});
