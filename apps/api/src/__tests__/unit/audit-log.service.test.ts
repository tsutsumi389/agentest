import { describe, it, expect, vi, beforeEach } from 'vitest';

// AuditLogRepository のモック（ホイスティングが必要）
const mockAuditLogRepo = vi.hoisted(() => ({
  create: vi.fn(),
  findByOrganization: vi.fn(),
  findByUser: vi.fn(),
  findForExport: vi.fn(),
}));

vi.mock('../../repositories/audit-log.repository.js', () => ({
  AuditLogRepository: vi.fn().mockImplementation(() => mockAuditLogRepo),
}));

import { AuditLogService } from '../../services/audit-log.service.js';

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    // console出力を抑制
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    service = new AuditLogService();
  });

  describe('log', () => {
    it('監査ログを正常に記録できる', async () => {
      const params = {
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
      mockAuditLogRepo.create.mockResolvedValue({ id: 'log-1', ...params });

      await service.log(params);

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(params);
    });

    it('actionが空文字の場合は記録をスキップする', async () => {
      const params = {
        userId: 'user-1',
        category: 'AUTH' as const,
        action: '',
      };

      await service.log(params);

      expect(mockAuditLogRepo.create).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        '監査ログ: actionが空のため記録をスキップ',
        params
      );
    });

    it('actionが空白のみの場合は記録をスキップする', async () => {
      const params = {
        userId: 'user-1',
        category: 'AUTH' as const,
        action: '   ',
      };

      await service.log(params);

      expect(mockAuditLogRepo.create).not.toHaveBeenCalled();
    });

    it('actionがundefinedの場合は記録をスキップする', async () => {
      const params = {
        userId: 'user-1',
        category: 'AUTH' as const,
        action: undefined as unknown as string,
      };

      await service.log(params);

      expect(mockAuditLogRepo.create).not.toHaveBeenCalled();
    });

    it('リポジトリでエラーが発生しても例外を投げずに警告を出力する', async () => {
      const params = {
        userId: 'user-1',
        category: 'USER' as const,
        action: 'user.update',
      };
      const error = new Error('DB接続エラー');
      mockAuditLogRepo.create.mockRejectedValue(error);

      // 例外が投げられないことを確認
      await expect(service.log(params)).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        '監査ログの記録に失敗:',
        error
      );
    });

    it('最小限のパラメータで記録できる', async () => {
      const params = {
        category: 'MEMBER' as const,
        action: 'member.add',
      };
      mockAuditLogRepo.create.mockResolvedValue({ id: 'log-1', ...params });

      await service.log(params);

      expect(mockAuditLogRepo.create).toHaveBeenCalledWith(params);
    });
  });

  describe('getByOrganization', () => {
    const mockLogs = [
      {
        id: 'log-1',
        organizationId: 'org-1',
        category: 'ORGANIZATION',
        action: 'organization.update',
        createdAt: new Date(),
      },
      {
        id: 'log-2',
        organizationId: 'org-1',
        category: 'MEMBER',
        action: 'member.add',
        createdAt: new Date(),
      },
    ];

    it('組織の監査ログを取得できる', async () => {
      mockAuditLogRepo.findByOrganization.mockResolvedValue({
        logs: mockLogs,
        total: 2,
      });

      const result = await service.getByOrganization('org-1');

      expect(mockAuditLogRepo.findByOrganization).toHaveBeenCalledWith(
        'org-1',
        {}
      );
      expect(result).toEqual({ logs: mockLogs, total: 2 });
    });

    it('オプションを指定して取得できる', async () => {
      const options = {
        page: 2,
        limit: 10,
        category: 'MEMBER' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };
      mockAuditLogRepo.findByOrganization.mockResolvedValue({
        logs: [mockLogs[1]],
        total: 1,
      });

      const result = await service.getByOrganization('org-1', options);

      expect(mockAuditLogRepo.findByOrganization).toHaveBeenCalledWith(
        'org-1',
        options
      );
      expect(result).toEqual({ logs: [mockLogs[1]], total: 1 });
    });

    it('ログが存在しない場合は空配列を返す', async () => {
      mockAuditLogRepo.findByOrganization.mockResolvedValue({
        logs: [],
        total: 0,
      });

      const result = await service.getByOrganization('org-1');

      expect(result).toEqual({ logs: [], total: 0 });
    });
  });

  describe('getByUser', () => {
    const mockLogs = [
      {
        id: 'log-1',
        userId: 'user-1',
        category: 'AUTH',
        action: 'auth.login',
        createdAt: new Date(),
      },
    ];

    it('ユーザーの監査ログを取得できる', async () => {
      mockAuditLogRepo.findByUser.mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });

      const result = await service.getByUser('user-1');

      expect(mockAuditLogRepo.findByUser).toHaveBeenCalledWith('user-1', {});
      expect(result).toEqual({ logs: mockLogs, total: 1 });
    });

    it('オプションを指定して取得できる', async () => {
      const options = {
        page: 1,
        limit: 20,
        category: 'AUTH' as const,
      };
      mockAuditLogRepo.findByUser.mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });

      const result = await service.getByUser('user-1', options);

      expect(mockAuditLogRepo.findByUser).toHaveBeenCalledWith(
        'user-1',
        options
      );
      expect(result).toEqual({ logs: mockLogs, total: 1 });
    });

    it('ログが存在しない場合は空配列を返す', async () => {
      mockAuditLogRepo.findByUser.mockResolvedValue({
        logs: [],
        total: 0,
      });

      const result = await service.getByUser('user-1');

      expect(result).toEqual({ logs: [], total: 0 });
    });
  });

  describe('getForExport', () => {
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

    it('リポジトリのfindForExportを呼び出す', async () => {
      mockAuditLogRepo.findForExport.mockResolvedValue(mockLogsWithUser);

      const result = await service.getForExport('org-1');

      expect(mockAuditLogRepo.findForExport).toHaveBeenCalledWith('org-1', {});
      expect(result).toEqual(mockLogsWithUser);
    });

    it('オプションを正しく渡す', async () => {
      const options = {
        category: 'MEMBER' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };
      mockAuditLogRepo.findForExport.mockResolvedValue([]);

      await service.getForExport('org-1', options);

      expect(mockAuditLogRepo.findForExport).toHaveBeenCalledWith('org-1', options);
    });
  });

  describe('formatAsCSV', () => {
    const BOM = '\uFEFF';

    it('UTF-8 BOM付きで出力する', () => {
      const result = service.formatAsCSV([]);

      expect(result.startsWith(BOM)).toBe(true);
    });

    it('正しいCSVヘッダーを出力する', () => {
      const result = service.formatAsCSV([]);

      const headerLine = result.replace(BOM, '').split('\n')[0];
      expect(headerLine).toBe('ID,日時,カテゴリ,アクション,ユーザー,対象タイプ,対象ID,IPアドレス,詳細');
    });

    it('日時をISO形式で出力する', () => {
      const createdAt = new Date('2024-01-15T10:30:00.000Z');
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: 'user-1',
          category: 'ORGANIZATION' as const,
          action: 'organization.update',
          createdAt,
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details: null,
          user: { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        },
      ];

      const result = service.formatAsCSV(logs);

      expect(result).toContain(createdAt.toISOString());
    });

    it('detailsをJSON文字列で出力する', () => {
      const details = { key: 'value', nested: { a: 1 } };
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: 'user-1',
          category: 'ORGANIZATION' as const,
          action: 'organization.update',
          createdAt: new Date(),
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details,
          user: { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        },
      ];

      const result = service.formatAsCSV(logs);

      // JSON文字列をエスケープした形式で含まれている
      expect(result).toContain('"{""key"":""value""');
    });

    it('ユーザーのメールを出力する', () => {
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: 'user-1',
          category: 'ORGANIZATION' as const,
          action: 'organization.update',
          createdAt: new Date(),
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details: null,
          user: { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        },
      ];

      const result = service.formatAsCSV(logs);

      expect(result).toContain('user1@example.com');
    });

    it('カンマを含む値をダブルクォートで囲む', () => {
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: null,
          category: 'ORGANIZATION' as const,
          action: 'action,with,commas',
          createdAt: new Date(),
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details: null,
          user: null,
        },
      ];

      const result = service.formatAsCSV(logs);

      expect(result).toContain('"action,with,commas"');
    });

    it('ダブルクォートを含む値をエスケープする', () => {
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: null,
          category: 'ORGANIZATION' as const,
          action: 'action"with"quotes',
          createdAt: new Date(),
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details: null,
          user: null,
        },
      ];

      const result = service.formatAsCSV(logs);

      expect(result).toContain('"action""with""quotes"');
    });

    it('改行を含む値を正しく処理する', () => {
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: null,
          category: 'ORGANIZATION' as const,
          action: 'action\nwith\nnewlines',
          createdAt: new Date(),
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details: null,
          user: null,
        },
      ];

      const result = service.formatAsCSV(logs);

      expect(result).toContain('"action\nwith\nnewlines"');
    });

    it('空配列の場合はヘッダーのみ出力する', () => {
      const result = service.formatAsCSV([]);

      const lines = result.replace(BOM, '').split('\n');
      // ヘッダー + 改行後の空行（rowsが空なので）
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('ID,日時,カテゴリ,アクション,ユーザー,対象タイプ,対象ID,IPアドレス,詳細');
      expect(lines[1]).toBe(''); // 空のデータ行
    });

    it('userがnullの場合は「システム」を出力する', () => {
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: null,
          category: 'ORGANIZATION' as const,
          action: 'organization.update',
          createdAt: new Date(),
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details: null,
          user: null,
        },
      ];

      const result = service.formatAsCSV(logs);

      expect(result).toContain('システム');
    });
  });

  describe('formatAsJSON', () => {
    it('整形されたJSONを出力する', () => {
      const createdAt = new Date('2024-01-15T10:30:00.000Z');
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: 'user-1',
          category: 'ORGANIZATION' as const,
          action: 'organization.update',
          createdAt,
          targetType: 'organization',
          targetId: 'org-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          details: { name: 'テスト組織' },
          user: { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        },
      ];

      const result = service.formatAsJSON(logs);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        id: 'log-1',
        createdAt: createdAt.toISOString(),
        category: 'ORGANIZATION',
        action: 'organization.update',
        user: { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        targetType: 'organization',
        targetId: 'org-1',
        ipAddress: '192.168.1.1',
        details: { name: 'テスト組織' },
      });
    });

    it('空配列を正しく処理する', () => {
      const result = service.formatAsJSON([]);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });

    it('userがnullの場合はnullを出力する', () => {
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: null,
          category: 'ORGANIZATION' as const,
          action: 'organization.update',
          createdAt: new Date(),
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details: null,
          user: null,
        },
      ];

      const result = service.formatAsJSON(logs);
      const parsed = JSON.parse(result);

      expect(parsed[0].user).toBeNull();
    });

    it('整形されたJSON（インデント2）で出力する', () => {
      const logs = [
        {
          id: 'log-1',
          organizationId: 'org-1',
          userId: null,
          category: 'ORGANIZATION' as const,
          action: 'organization.update',
          createdAt: new Date(),
          targetType: null,
          targetId: null,
          ipAddress: null,
          userAgent: null,
          details: null,
          user: null,
        },
      ];

      const result = service.formatAsJSON(logs);

      // 整形されているか確認（改行とインデントがある）
      expect(result).toContain('\n');
      expect(result).toContain('  '); // インデント2
    });
  });
});
