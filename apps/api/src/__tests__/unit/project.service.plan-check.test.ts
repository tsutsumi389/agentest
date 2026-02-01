import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BusinessError } from '@agentest/shared';

// Prismaモック（vi.mockより先に定義してはいけないのでvi.hoisted使用）
const { mockPrisma, mockProjectRepo, mockNotificationService } = vi.hoisted(() => ({
  mockPrisma: {
    organization: {
      findUnique: vi.fn(),
    },
    project: {
      create: vi.fn(),
    },
    projectMember: {
      create: vi.fn(),
    },
    projectHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockProjectRepo: {
    createHistory: vi.fn(),
  },
  mockNotificationService: {
    send: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// リポジトリモック
vi.mock('../../repositories/project.repository.js', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => mockProjectRepo),
}));

vi.mock('../../repositories/test-suite.repository.js', () => ({
  TestSuiteRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../services/notification.service.js', () => ({
  notificationService: mockNotificationService,
}));

// vi.mockの後にインポート
import { ProjectService } from '../../services/project.service.js';

describe('ProjectService - プランチェック', () => {
  let service: ProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectService();
  });

  describe('create', () => {
    const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
    const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';

    it('NONEプランの組織ではプロジェクトを作成できない', async () => {
      // NONEプランの組織を返す
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: TEST_ORG_ID,
        plan: 'NONE',
      });

      await expect(
        service.create(TEST_USER_ID, {
          name: 'Test Project',
          organizationId: TEST_ORG_ID,
        })
      ).rejects.toThrow(BusinessError);

      await expect(
        service.create(TEST_USER_ID, {
          name: 'Test Project',
          organizationId: TEST_ORG_ID,
        })
      ).rejects.toMatchObject({
        code: 'PLAN_REQUIRED',
        message: 'プロジェクトを作成するにはプランの契約が必要です',
      });

      // トランザクションが呼ばれていないことを確認
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('TEAMプランの組織ではプロジェクトを作成できる', async () => {
      // TEAMプランの組織を返す
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: TEST_ORG_ID,
        plan: 'TEAM',
      });

      const mockProject = {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Test Project',
        description: null,
        organizationId: TEST_ORG_ID,
      };

      mockPrisma.$transaction.mockResolvedValue(mockProject);

      const result = await service.create(TEST_USER_ID, {
        name: 'Test Project',
        organizationId: TEST_ORG_ID,
      });

      expect(result).toEqual(mockProject);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('ENTERPRISEプランの組織ではプロジェクトを作成できる', async () => {
      // ENTERPRISEプランの組織を返す
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: TEST_ORG_ID,
        plan: 'ENTERPRISE',
      });

      const mockProject = {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Test Project',
        description: null,
        organizationId: TEST_ORG_ID,
      };

      mockPrisma.$transaction.mockResolvedValue(mockProject);

      const result = await service.create(TEST_USER_ID, {
        name: 'Test Project',
        organizationId: TEST_ORG_ID,
      });

      expect(result).toEqual(mockProject);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('個人プロジェクト（organizationId=null）は作成できる', async () => {
      const mockProject = {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Personal Project',
        description: null,
        organizationId: null,
      };

      mockPrisma.$transaction.mockResolvedValue(mockProject);

      const result = await service.create(TEST_USER_ID, {
        name: 'Personal Project',
        organizationId: null,
      });

      expect(result).toEqual(mockProject);
      // 組織チェックが呼ばれていないことを確認
      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('個人プロジェクト（organizationIdなし）は作成できる', async () => {
      const mockProject = {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Personal Project',
        description: null,
        organizationId: null,
      };

      mockPrisma.$transaction.mockResolvedValue(mockProject);

      const result = await service.create(TEST_USER_ID, {
        name: 'Personal Project',
      });

      expect(result).toEqual(mockProject);
      // 組織チェックが呼ばれていないことを確認
      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
