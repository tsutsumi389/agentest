import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { OrganizationController } from '../../controllers/organization.controller.js';

// AuditLogService のモック
const mockAuditLogService = vi.hoisted(() => ({
  getByOrganization: vi.fn(),
  getByUser: vi.fn(),
  log: vi.fn(),
  getForExport: vi.fn(),
  formatAsCSV: vi.fn(),
  formatAsJSON: vi.fn(),
}));

vi.mock('../../services/audit-log.service.js', () => ({
  auditLogService: mockAuditLogService,
  AUDIT_LOG_DEFAULT_LIMIT: 50,
  AUDIT_LOG_MAX_LIMIT: 100,
}));

// OrganizationService のモック（コントローラーが依存しているため）
vi.mock('../../services/organization.service.js', () => ({
  OrganizationService: vi.fn().mockImplementation(() => ({})),
}));

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: 'user-1', email: 'test@example.com' } as any,
  params: { organizationId: 'org-1' },
  query: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext: NextFunction = vi.fn();

describe('OrganizationController - getAuditLogs', () => {
  let controller: OrganizationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OrganizationController();
  });

  describe('getAuditLogs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        organizationId: 'org-1',
        category: 'ORGANIZATION',
        action: 'organization.update',
        createdAt: new Date('2024-01-15'),
        user: { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
      },
      {
        id: 'log-2',
        organizationId: 'org-1',
        category: 'MEMBER',
        action: 'member.add',
        createdAt: new Date('2024-01-10'),
        user: { id: 'user-2', email: 'user2@example.com', name: 'User 2' },
      },
    ];

    it('監査ログを取得できる', async () => {
      mockAuditLogService.getByOrganization.mockResolvedValue({
        logs: mockLogs,
        total: 2,
      });

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getByOrganization).toHaveBeenCalledWith('org-1', {
        page: 1,
        limit: 50,
        category: undefined,
        startDate: undefined,
        endDate: undefined,
      });
      expect(res.json).toHaveBeenCalledWith({
        logs: mockLogs,
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
    });

    it('ページネーションを指定して取得できる', async () => {
      mockAuditLogService.getByOrganization.mockResolvedValue({
        logs: [mockLogs[1]],
        total: 2,
      });

      const req = mockRequest({
        query: { page: '2', limit: '1' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getByOrganization).toHaveBeenCalledWith('org-1', {
        page: 2,
        limit: 1,
        category: undefined,
        startDate: undefined,
        endDate: undefined,
      });
      expect(res.json).toHaveBeenCalledWith({
        logs: [mockLogs[1]],
        total: 2,
        page: 2,
        limit: 1,
        totalPages: 2,
      });
    });

    it('カテゴリでフィルタして取得できる', async () => {
      mockAuditLogService.getByOrganization.mockResolvedValue({
        logs: [mockLogs[1]],
        total: 1,
      });

      const req = mockRequest({
        query: { category: 'MEMBER' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getByOrganization).toHaveBeenCalledWith('org-1', {
        page: 1,
        limit: 50,
        category: 'MEMBER',
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('日付範囲でフィルタして取得できる', async () => {
      mockAuditLogService.getByOrganization.mockResolvedValue({
        logs: mockLogs,
        total: 2,
      });

      const req = mockRequest({
        query: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getByOrganization).toHaveBeenCalledWith('org-1', {
        page: 1,
        limit: 50,
        category: undefined,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });
    });

    it('空の結果を正しく返す', async () => {
      mockAuditLogService.getByOrganization.mockResolvedValue({
        logs: [],
        total: 0,
      });

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        logs: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      });
    });

    it('totalPagesが正しく計算される', async () => {
      mockAuditLogService.getByOrganization.mockResolvedValue({
        logs: mockLogs,
        total: 150,
      });

      const req = mockRequest({
        query: { limit: '25' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        logs: mockLogs,
        total: 150,
        page: 1,
        limit: 25,
        totalPages: 6, // Math.ceil(150 / 25)
      });
    });

    it('不正なページ番号はバリデーションエラー', async () => {
      const req = mockRequest({
        query: { page: '0' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getByOrganization).not.toHaveBeenCalled();
    });

    it('不正なlimitはバリデーションエラー', async () => {
      const req = mockRequest({
        query: { limit: '200' }, // MAX_LIMITを超える
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getByOrganization).not.toHaveBeenCalled();
    });

    it('不正なカテゴリはバリデーションエラー', async () => {
      const req = mockRequest({
        query: { category: 'INVALID_CATEGORY' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getByOrganization).not.toHaveBeenCalled();
    });

    it('startDate > endDateはバリデーションエラー', async () => {
      const req = mockRequest({
        query: {
          startDate: '2024-12-31',
          endDate: '2024-01-01',
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getByOrganization).not.toHaveBeenCalled();
    });

    it('不正な日付形式はバリデーションエラー', async () => {
      const req = mockRequest({
        query: { startDate: 'invalid-date' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getByOrganization).not.toHaveBeenCalled();
    });

    it('サービスエラーはnextに渡される', async () => {
      const error = new Error('DB接続エラー');
      mockAuditLogService.getByOrganization.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('全てのオプションを組み合わせて取得できる', async () => {
      mockAuditLogService.getByOrganization.mockResolvedValue({
        logs: [mockLogs[0]],
        total: 1,
      });

      const req = mockRequest({
        query: {
          page: '1',
          limit: '10',
          category: 'ORGANIZATION',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getByOrganization).toHaveBeenCalledWith('org-1', {
        page: 1,
        limit: 10,
        category: 'ORGANIZATION',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });
    });
  });
});

describe('OrganizationController - exportAuditLogs', () => {
  let controller: OrganizationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OrganizationController();
  });

  describe('exportAuditLogs', () => {
    const mockLogsWithUser = [
      {
        id: 'log-1',
        organizationId: 'org-1',
        category: 'ORGANIZATION',
        action: 'organization.update',
        createdAt: new Date('2024-01-15'),
        targetType: 'organization',
        targetId: 'org-1',
        ipAddress: '192.168.1.1',
        details: { name: 'テスト組織' },
        user: { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
      },
    ];

    it('format=csvでCSVをエクスポートする', async () => {
      mockAuditLogService.getForExport.mockResolvedValue(mockLogsWithUser);
      mockAuditLogService.formatAsCSV.mockReturnValue('csv-content');

      const req = mockRequest({
        query: { format: 'csv' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getForExport).toHaveBeenCalledWith('org-1', {
        category: undefined,
        startDate: undefined,
        endDate: undefined,
      });
      expect(mockAuditLogService.formatAsCSV).toHaveBeenCalledWith(mockLogsWithUser);
      expect(res.send).toHaveBeenCalledWith('csv-content');
    });

    it('format=jsonでJSONをエクスポートする', async () => {
      mockAuditLogService.getForExport.mockResolvedValue(mockLogsWithUser);
      mockAuditLogService.formatAsJSON.mockReturnValue('json-content');

      const req = mockRequest({
        query: { format: 'json' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getForExport).toHaveBeenCalledWith('org-1', {
        category: undefined,
        startDate: undefined,
        endDate: undefined,
      });
      expect(mockAuditLogService.formatAsJSON).toHaveBeenCalledWith(mockLogsWithUser);
      expect(res.send).toHaveBeenCalledWith('json-content');
    });

    it('formatが未指定の場合はエラーを返す', async () => {
      const req = mockRequest({
        query: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getForExport).not.toHaveBeenCalled();
    });

    it('categoryフィルタを渡す', async () => {
      mockAuditLogService.getForExport.mockResolvedValue([]);
      mockAuditLogService.formatAsCSV.mockReturnValue('');

      const req = mockRequest({
        query: { format: 'csv', category: 'MEMBER' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getForExport).toHaveBeenCalledWith('org-1', {
        category: 'MEMBER',
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('startDateとendDateフィルタを渡す', async () => {
      mockAuditLogService.getForExport.mockResolvedValue([]);
      mockAuditLogService.formatAsCSV.mockReturnValue('');

      const req = mockRequest({
        query: {
          format: 'csv',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockAuditLogService.getForExport).toHaveBeenCalledWith('org-1', {
        category: undefined,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });
    });

    it('CSVの場合Content-Typeがtext/csvになる', async () => {
      mockAuditLogService.getForExport.mockResolvedValue([]);
      mockAuditLogService.formatAsCSV.mockReturnValue('');

      const req = mockRequest({
        query: { format: 'csv' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    });

    it('JSONの場合Content-Typeがapplication/jsonになる', async () => {
      mockAuditLogService.getForExport.mockResolvedValue([]);
      mockAuditLogService.formatAsJSON.mockReturnValue('[]');

      const req = mockRequest({
        query: { format: 'json' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    });

    it('Content-Dispositionにファイル名が含まれる', async () => {
      mockAuditLogService.getForExport.mockResolvedValue([]);
      mockAuditLogService.formatAsCSV.mockReturnValue('');

      const req = mockRequest({
        query: { format: 'csv' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/^attachment; filename="audit-logs-\d{8}-\d{6}\.csv"$/)
      );
    });

    it('ファイル名にタイムスタンプが含まれる', async () => {
      mockAuditLogService.getForExport.mockResolvedValue([]);
      mockAuditLogService.formatAsJSON.mockReturnValue('[]');

      const req = mockRequest({
        query: { format: 'json' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringMatching(/^attachment; filename="audit-logs-\d{8}-\d{6}\.json"$/)
      );
    });

    it('無効なformatの場合はバリデーションエラーを返す', async () => {
      const req = mockRequest({
        query: { format: 'xml' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getForExport).not.toHaveBeenCalled();
    });

    it('無効なcategoryの場合はバリデーションエラーを返す', async () => {
      const req = mockRequest({
        query: { format: 'csv', category: 'INVALID' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getForExport).not.toHaveBeenCalled();
    });

    it('startDate > endDateの場合はバリデーションエラーを返す', async () => {
      const req = mockRequest({
        query: {
          format: 'csv',
          startDate: '2024-12-31',
          endDate: '2024-01-01',
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAuditLogService.getForExport).not.toHaveBeenCalled();
    });

    it('サービスエラーはnextに渡される', async () => {
      const error = new Error('DB接続エラー');
      mockAuditLogService.getForExport.mockRejectedValue(error);

      const req = mockRequest({
        query: { format: 'csv' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.exportAuditLogs(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
