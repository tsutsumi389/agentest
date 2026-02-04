import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// 監査ログサービスのモック
const mockAuditLogsService = {
  findAuditLogs: vi.fn(),
};

vi.mock('../../services/admin/admin-audit-logs.service.js', () => ({
  AdminAuditLogsService: vi.fn().mockImplementation(() => mockAuditLogsService),
}));

// @agentest/shared と @agentest/shared/validators のモック
vi.mock('@agentest/shared', () => ({
  AuthenticationError: class AuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string, public fields: Record<string, string[]>) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

// vi.hoistedを使用してモック変数をホイスティングする
const mockSafeParse = vi.hoisted(() => vi.fn());
vi.mock('@agentest/shared/validators', () => ({
  adminAuditLogSearchSchema: {
    safeParse: mockSafeParse,
  },
}));

// コントローラーのインポートはモック設定後
import { AdminAuditLogsController } from '../../controllers/admin/audit-logs.controller.js';

// モックリクエストヘルパー
const mockRequest = (overrides = {}): Partial<Request> => ({
  adminUser: { id: 'admin-1', role: 'SUPER_ADMIN' } as any,
  params: {},
  body: {},
  query: {},
  ...overrides,
});

// モックレスポンスヘルパー
const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('AdminAuditLogsController', () => {
  let controller: AdminAuditLogsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminAuditLogsController();
  });

  describe('list', () => {
    it('監査ログ一覧を正常に返す', async () => {
      // 準備: バリデーション成功・サービスがログデータを返すようモックする
      const parsedQuery = { page: 1, limit: 20 };
      mockSafeParse.mockReturnValue({
        success: true,
        data: parsedQuery,
      });

      const logsData = {
        items: [
          { id: 'log-1', action: 'LOGIN', adminId: 'admin-1' },
          { id: 'log-2', action: 'UPDATE_USER', adminId: 'admin-1' },
        ],
        total: 2,
      };
      mockAuditLogsService.findAuditLogs.mockResolvedValue(logsData);

      const req = mockRequest({ query: { page: '1', limit: '20' } });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.list(req as Request, res as Response, next);

      // 検証: バリデーション・サービス呼び出し・JSONレスポンスが正常に行われる
      expect(mockSafeParse).toHaveBeenCalledWith(req.query);
      expect(mockAuditLogsService.findAuditLogs).toHaveBeenCalledWith(parsedQuery);
      expect(res.json).toHaveBeenCalledWith(logsData);
      expect(next).not.toHaveBeenCalled();
    });

    it('adminUser未認証時はnextにエラーを渡す', async () => {
      // 準備: adminUserがないリクエスト
      const req = mockRequest({ adminUser: undefined });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.list(req as Request, res as Response, next);

      // 検証: AuthenticationErrorがnextに渡される
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AuthenticationError',
          message: '認証が必要です',
        })
      );
      expect(res.json).not.toHaveBeenCalled();
    });

    it('バリデーションエラー時はnextにValidationErrorを渡す', async () => {
      // 準備: バリデーションが失敗するようモックする
      const fieldErrors = { page: ['正の整数を指定してください'] };
      mockSafeParse.mockReturnValue({
        success: false,
        error: {
          flatten: () => ({ fieldErrors }),
        },
      });

      const req = mockRequest({ query: { page: 'invalid' } });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.list(req as Request, res as Response, next);

      // 検証: ValidationErrorがnextに渡される
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ValidationError',
          message: 'リクエストパラメータが不正です',
          fields: fieldErrors,
        })
      );
      expect(mockAuditLogsService.findAuditLogs).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('サービスエラー時はnextに渡す', async () => {
      // 準備: バリデーション成功・サービスがエラーをスローするようモックする
      mockSafeParse.mockReturnValue({
        success: true,
        data: { page: 1, limit: 20 },
      });
      const serviceError = new Error('データベース接続エラー');
      mockAuditLogsService.findAuditLogs.mockRejectedValue(serviceError);

      const req = mockRequest({ query: { page: '1', limit: '20' } });
      const res = mockResponse();
      const next = vi.fn() as unknown as NextFunction;

      // 実行
      await controller.list(req as Request, res as Response, next);

      // 検証: エラーがnextに渡される
      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
