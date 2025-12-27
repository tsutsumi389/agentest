import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AuditLogRepository,
  AUDIT_LOG_DEFAULT_LIMIT,
  AUDIT_LOG_MAX_LIMIT,
} from '../../repositories/audit-log.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaAuditLog = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    auditLog: mockPrismaAuditLog,
  },
}));

describe('AuditLogRepository', () => {
  let repository: AuditLogRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AuditLogRepository();
  });

  describe('定数', () => {
    it('AUDIT_LOG_DEFAULT_LIMITは50である', () => {
      expect(AUDIT_LOG_DEFAULT_LIMIT).toBe(50);
    });

    it('AUDIT_LOG_MAX_LIMITは100である', () => {
      expect(AUDIT_LOG_MAX_LIMIT).toBe(100);
    });
  });

  describe('create', () => {
    it('監査ログを作成できる', async () => {
      const logData = {
        userId: 'user-1',
        organizationId: 'org-1',
        category: 'ORGANIZATION' as const,
        action: 'organization.create',
        targetType: 'organization',
        targetId: 'org-1',
        details: { name: 'テスト組織' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };
      const mockLog = { id: 'log-1', ...logData, createdAt: new Date() };
      mockPrismaAuditLog.create.mockResolvedValue(mockLog);

      const result = await repository.create(logData);

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: logData.userId,
          organizationId: logData.organizationId,
          category: logData.category,
          action: logData.action,
          targetType: logData.targetType,
          targetId: logData.targetId,
          details: logData.details,
          ipAddress: logData.ipAddress,
          userAgent: logData.userAgent,
        },
      });
      expect(result).toEqual(mockLog);
    });

    it('最小限のパラメータで作成できる', async () => {
      const logData = {
        category: 'AUTH' as const,
        action: 'auth.login',
      };
      const mockLog = { id: 'log-1', ...logData, createdAt: new Date() };
      mockPrismaAuditLog.create.mockResolvedValue(mockLog);

      const result = await repository.create(logData);

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          organizationId: undefined,
          category: logData.category,
          action: logData.action,
          targetType: undefined,
          targetId: undefined,
          details: undefined,
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
      expect(result).toEqual(mockLog);
    });
  });

  describe('findByOrganization', () => {
    const mockLogs = [
      {
        id: 'log-1',
        organizationId: 'org-1',
        category: 'ORGANIZATION',
        action: 'organization.update',
        createdAt: new Date('2024-01-15'),
        user: { id: 'user-1', email: 'user1@example.com', name: 'User 1', avatarUrl: null },
      },
      {
        id: 'log-2',
        organizationId: 'org-1',
        category: 'MEMBER',
        action: 'member.add',
        createdAt: new Date('2024-01-10'),
        user: { id: 'user-2', email: 'user2@example.com', name: 'User 2', avatarUrl: null },
      },
    ];

    it('組織の監査ログを取得できる', async () => {
      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaAuditLog.count.mockResolvedValue(2);

      const result = await repository.findByOrganization('org-1');

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: AUDIT_LOG_DEFAULT_LIMIT,
      });
      expect(mockPrismaAuditLog.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
      });
      expect(result).toEqual({ logs: mockLogs, total: 2 });
    });

    it('ページネーションを指定して取得できる', async () => {
      mockPrismaAuditLog.findMany.mockResolvedValue([mockLogs[1]]);
      mockPrismaAuditLog.count.mockResolvedValue(2);

      const result = await repository.findByOrganization('org-1', {
        page: 2,
        limit: 1,
      });

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 1, // (2 - 1) * 1
        take: 1,
      });
      expect(result).toEqual({ logs: [mockLogs[1]], total: 2 });
    });

    it('カテゴリでフィルタできる', async () => {
      mockPrismaAuditLog.findMany.mockResolvedValue([mockLogs[1]]);
      mockPrismaAuditLog.count.mockResolvedValue(1);

      const result = await repository.findByOrganization('org-1', {
        category: 'MEMBER',
      });

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          category: 'MEMBER',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: AUDIT_LOG_DEFAULT_LIMIT,
      });
      expect(result).toEqual({ logs: [mockLogs[1]], total: 1 });
    });

    it('日付範囲でフィルタできる', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaAuditLog.count.mockResolvedValue(2);

      const result = await repository.findByOrganization('org-1', {
        startDate,
        endDate,
      });

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: AUDIT_LOG_DEFAULT_LIMIT,
      });
      expect(result).toEqual({ logs: mockLogs, total: 2 });
    });

    it('startDateのみでフィルタできる', async () => {
      const startDate = new Date('2024-01-01');
      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaAuditLog.count.mockResolvedValue(2);

      await repository.findByOrganization('org-1', { startDate });

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          createdAt: {
            gte: startDate,
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: AUDIT_LOG_DEFAULT_LIMIT,
      });
    });

    it('endDateのみでフィルタできる', async () => {
      const endDate = new Date('2024-01-31');
      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaAuditLog.count.mockResolvedValue(2);

      await repository.findByOrganization('org-1', { endDate });

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          createdAt: {
            lte: endDate,
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: AUDIT_LOG_DEFAULT_LIMIT,
      });
    });

    it('limitがMAX_LIMITを超える場合はMAX_LIMITに制限される', async () => {
      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaAuditLog.count.mockResolvedValue(2);

      await repository.findByOrganization('org-1', { limit: 200 });

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: AUDIT_LOG_MAX_LIMIT, // 200ではなく100
      });
    });

    it('ログが存在しない場合は空配列を返す', async () => {
      mockPrismaAuditLog.findMany.mockResolvedValue([]);
      mockPrismaAuditLog.count.mockResolvedValue(0);

      const result = await repository.findByOrganization('org-1');

      expect(result).toEqual({ logs: [], total: 0 });
    });
  });

  describe('findByUser', () => {
    const mockLogs = [
      {
        id: 'log-1',
        userId: 'user-1',
        organizationId: null,
        category: 'AUTH',
        action: 'auth.login',
        createdAt: new Date(),
        user: { id: 'user-1', email: 'user1@example.com', name: 'User 1', avatarUrl: null },
      },
    ];

    it('ユーザーの個人監査ログを取得できる', async () => {
      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaAuditLog.count.mockResolvedValue(1);

      const result = await repository.findByUser('user-1');

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: null, // 個人の監査ログのみ
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: AUDIT_LOG_DEFAULT_LIMIT,
      });
      expect(result).toEqual({ logs: mockLogs, total: 1 });
    });

    it('オプションを指定して取得できる', async () => {
      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaAuditLog.count.mockResolvedValue(1);

      const options = {
        page: 1,
        limit: 10,
        category: 'AUTH' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };

      await repository.findByUser('user-1', options);

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: null,
          category: 'AUTH',
          createdAt: {
            gte: options.startDate,
            lte: options.endDate,
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('limitがMAX_LIMITを超える場合はMAX_LIMITに制限される', async () => {
      mockPrismaAuditLog.findMany.mockResolvedValue([]);
      mockPrismaAuditLog.count.mockResolvedValue(0);

      await repository.findByUser('user-1', { limit: 500 });

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organizationId: null,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: AUDIT_LOG_MAX_LIMIT,
      });
    });
  });
});
