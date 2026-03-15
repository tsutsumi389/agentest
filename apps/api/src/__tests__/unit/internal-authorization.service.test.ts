import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prismaモック
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  projectMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  organizationMember: {
    findUnique: vi.fn(),
  },
  testSuite: {
    findUnique: vi.fn(),
  },
  execution: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

import { InternalAuthorizationService } from '../../services/internal-authorization.service.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_ORG_ID = '33333333-3333-3333-3333-333333333333';
const TEST_SUITE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_EXECUTION_ID = '55555555-5555-5555-5555-555555555555';
const OTHER_PROJECT_ID = '66666666-6666-6666-6666-666666666666';

describe('InternalAuthorizationService', () => {
  let service: InternalAuthorizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InternalAuthorizationService();
  });

  describe('canAccessProject', () => {
    it('プロジェクトが存在しない場合はfalseを返す', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await service.canAccessProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(false);
      expect(mockPrisma.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it('削除済みプロジェクトの場合はfalseを返す', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: new Date(),
      });

      const result = await service.canAccessProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(false);
      expect(mockPrisma.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it('プロジェクトメンバーの場合はtrueを返す', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'READ',
      });

      const result = await service.canAccessProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(true);
      expect(mockPrisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: {
          projectId_userId: { projectId: TEST_PROJECT_ID, userId: TEST_USER_ID },
        },
      });
    });

    it('組織メンバー経由でアクセスできる場合はtrueを返す', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: TEST_ORG_ID,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role: 'MEMBER',
      });

      const result = await service.canAccessProject(TEST_USER_ID, TEST_PROJECT_ID);

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

    it('組織なしプロジェクトで非メンバーの場合はfalseを返す', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      const result = await service.canAccessProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(false);
      expect(mockPrisma.organizationMember.findUnique).not.toHaveBeenCalled();
    });

    it('組織ありプロジェクトで非メンバーかつ組織非メンバーの場合はfalseを返す', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: TEST_ORG_ID,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      const result = await service.canAccessProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(false);
    });
  });

  describe('canAccessTestSuite', () => {
    it('テストスイートが存在しない場合はfalseを返す', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      const result = await service.canAccessTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toBe(false);
      expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
    });

    it('削除済みテストスイートの場合はfalseを返す', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
        deletedAt: new Date(),
      });

      const result = await service.canAccessTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toBe(false);
      expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
    });

    it('プロジェクトにアクセスできる場合はtrueを返す', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
        deletedAt: null,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'READ',
      });

      const result = await service.canAccessTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toBe(true);
      expect(mockPrisma.testSuite.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_SUITE_ID },
        select: { id: true, projectId: true, deletedAt: true },
      });
    });

    it('プロジェクトにアクセスできない場合はfalseを返す', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
        deletedAt: null,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      const result = await service.canAccessTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toBe(false);
    });
  });

  describe('getAccessibleProjectIds', () => {
    it('直接参加プロジェクトと組織経由プロジェクトを結合して返す', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([{ projectId: TEST_PROJECT_ID }]);
      mockPrisma.project.findMany.mockResolvedValue([{ id: OTHER_PROJECT_ID }]);

      const result = await service.getAccessibleProjectIds(TEST_USER_ID);

      expect(result).toEqual(expect.arrayContaining([TEST_PROJECT_ID, OTHER_PROJECT_ID]));
      expect(result).toHaveLength(2);
    });

    it('重複するプロジェクトIDは排除される', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([{ projectId: TEST_PROJECT_ID }]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: TEST_PROJECT_ID }, // 重複
        { id: OTHER_PROJECT_ID },
      ]);

      const result = await service.getAccessibleProjectIds(TEST_USER_ID);

      expect(result).toEqual(expect.arrayContaining([TEST_PROJECT_ID, OTHER_PROJECT_ID]));
      expect(result).toHaveLength(2);
    });

    it('アクセス可能なプロジェクトがない場合は空配列を返す', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([]);
      mockPrisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAccessibleProjectIds(TEST_USER_ID);

      expect(result).toEqual([]);
    });

    it('削除済みプロジェクトをフィルタリングする条件でクエリする', async () => {
      mockPrisma.projectMember.findMany.mockResolvedValue([]);
      mockPrisma.project.findMany.mockResolvedValue([]);

      await service.getAccessibleProjectIds(TEST_USER_ID);

      expect(mockPrisma.projectMember.findMany).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          project: { deletedAt: null },
        },
        select: { projectId: true },
      });
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          organization: {
            members: {
              some: { userId: TEST_USER_ID },
            },
          },
          deletedAt: null,
        },
        select: { id: true },
      });
    });
  });

  describe('canWriteToProject', () => {
    it('プロジェクトが存在しない場合はfalseを返す', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await service.canWriteToProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(false);
    });

    it('削除済みプロジェクトの場合はfalseを返す', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: new Date(),
      });

      const result = await service.canWriteToProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(false);
    });

    it.each([
      'OWNER',
      'ADMIN',
      'WRITE',
    ] as const)('プロジェクトメンバーの%sロールはtrueを返す', async (role) => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role,
      });

      const result = await service.canWriteToProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(true);
    });

    it('READロールのプロジェクトメンバーはfalseを返す（組織なし）', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'READ',
      });

      const result = await service.canWriteToProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(false);
    });

    it.each(['OWNER', 'ADMIN'] as const)('組織%sは書き込み権限を持つ', async (role) => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: TEST_ORG_ID,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role,
      });

      const result = await service.canWriteToProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(true);
    });

    it('組織MEMBERは書き込み権限を持たない', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: TEST_ORG_ID,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        role: 'MEMBER',
      });

      const result = await service.canWriteToProject(TEST_USER_ID, TEST_PROJECT_ID);

      expect(result).toBe(false);
    });
  });

  describe('canWriteToTestSuite', () => {
    it('テストスイートが存在しない場合はfalseを返す', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      const result = await service.canWriteToTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toBe(false);
    });

    it('削除済みテストスイートの場合はfalseを返す', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
        deletedAt: new Date(),
      });

      const result = await service.canWriteToTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toBe(false);
    });

    it('プロジェクトに書き込み権限がある場合はtrueを返す', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
        deletedAt: null,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'WRITE',
      });

      const result = await service.canWriteToTestSuite(TEST_USER_ID, TEST_SUITE_ID);

      expect(result).toBe(true);
    });
  });

  describe('canWriteToExecution', () => {
    it('実行が存在しない場合はfalseを返す', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue(null);

      const result = await service.canWriteToExecution(TEST_USER_ID, TEST_EXECUTION_ID);

      expect(result).toBe(false);
    });

    it('テストスイートに書き込み権限がある場合はtrueを返す', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue({
        id: TEST_EXECUTION_ID,
        testSuiteId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
        deletedAt: null,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'ADMIN',
      });

      const result = await service.canWriteToExecution(TEST_USER_ID, TEST_EXECUTION_ID);

      expect(result).toBe(true);
      expect(mockPrisma.execution.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_EXECUTION_ID },
        select: { id: true, testSuiteId: true },
      });
    });

    it('テストスイートに書き込み権限がない場合はfalseを返す', async () => {
      mockPrisma.execution.findUnique.mockResolvedValue({
        id: TEST_EXECUTION_ID,
        testSuiteId: TEST_SUITE_ID,
      });
      mockPrisma.testSuite.findUnique.mockResolvedValue({
        id: TEST_SUITE_ID,
        projectId: TEST_PROJECT_ID,
        deletedAt: null,
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: null,
        deletedAt: null,
      });
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
        projectId: TEST_PROJECT_ID,
        role: 'READ',
      });

      const result = await service.canWriteToExecution(TEST_USER_ID, TEST_EXECUTION_ID);

      expect(result).toBe(false);
    });
  });
});
