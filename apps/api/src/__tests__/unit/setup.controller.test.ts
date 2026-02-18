import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthorizationError, ValidationError } from '@agentest/shared';

// トランザクション内で使われるPrismaモック
const mockTx = vi.hoisted(() => ({
  adminUser: {
    count: vi.fn(),
    create: vi.fn(),
  },
  adminAuditLog: {
    create: vi.fn(),
  },
}));

// Prismaモック（$transaction はコールバックに mockTx を渡して実行する）
const mockPrisma = vi.hoisted(() => ({
  adminUser: {
    count: vi.fn(),
  },
  $transaction: vi.fn((callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// bcryptモック
const mockBcrypt = vi.hoisted(() => ({
  hash: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
}));

// loggerモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn(), child: vi.fn() };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../../utils/logger.js', () => ({ logger: mockLogger }));

// コントローラーのインポートはモック設定後
import { AdminSetupController } from '../../controllers/admin/setup.controller.js';

// モックリクエスト・レスポンス・ネクスト
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    ...overrides,
  } as Request;
}

function createMockRes(): Response {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('AdminSetupController', () => {
  let controller: AdminSetupController;

  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction のデフォルト動作を再設定
    mockPrisma.$transaction.mockImplementation(
      (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx)
    );
    controller = new AdminSetupController();
  });

  describe('getStatus', () => {
    it('AdminUserが0件の場合 isSetupRequired: true を返す', async () => {
      mockPrisma.adminUser.count.mockResolvedValue(0);

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await controller.getStatus(req, res, next);

      expect(mockPrisma.adminUser.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(res.json).toHaveBeenCalledWith({ isSetupRequired: true });
    });

    it('AdminUserが1件以上の場合 isSetupRequired: false を返す', async () => {
      mockPrisma.adminUser.count.mockResolvedValue(3);

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await controller.getStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ isSetupRequired: false });
    });

    it('DB接続エラーの場合 next にエラーを渡す', async () => {
      const dbError = new Error('DB接続エラー');
      mockPrisma.adminUser.count.mockRejectedValue(dbError);

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      await controller.getStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('setup', () => {
    const validBody = {
      email: 'Admin@Example.com',
      name: 'Super Admin',
      password: 'SecureP@ss1',
    };

    it('AdminUserが0件の場合にSUPER_ADMINを作成する', async () => {
      mockTx.adminUser.count.mockResolvedValue(0);
      mockBcrypt.hash.mockResolvedValue('hashed-password');
      mockTx.adminUser.create.mockResolvedValue({
        id: 'admin-uuid-1',
        email: 'admin@example.com',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        passwordHash: 'hashed-password',
      });
      mockTx.adminAuditLog.create.mockResolvedValue({});

      const req = createMockReq({ body: validBody });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      // パスワードがbcryptでハッシュ化されること
      expect(mockBcrypt.hash).toHaveBeenCalledWith('SecureP@ss1', 12);

      // トランザクション内でAdminUserがSUPER_ADMINロールで作成されること
      expect(mockTx.adminUser.create).toHaveBeenCalledWith({
        data: {
          email: 'admin@example.com', // メールは小文字に変換される
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          passwordHash: 'hashed-password',
        },
      });

      // トランザクション内で監査ログが記録されること（ipAddress/userAgent含む）
      expect(mockTx.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          adminUserId: 'admin-uuid-1',
          action: 'INITIAL_SETUP',
          targetType: 'AdminUser',
          targetId: 'admin-uuid-1',
          details: { email: 'admin@example.com', name: 'Super Admin' },
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        },
      });

      // 201ステータスでレスポンスが返ること
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        admin: {
          id: 'admin-uuid-1',
          email: 'admin@example.com',
          name: 'Super Admin',
        },
      });
    });

    it('AdminUserが既に存在する場合はAuthorizationError', async () => {
      mockTx.adminUser.count.mockResolvedValue(1);

      const req = createMockReq({ body: validBody });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
      expect(mockTx.adminUser.create).not.toHaveBeenCalled();
    });

    it('バリデーションエラー: メール形式不正', async () => {
      const req = createMockReq({
        body: { ...validBody, email: 'invalid-email' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      // トランザクションは呼ばれない（バリデーションは前段で実施）
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('バリデーションエラー: 名前が空', async () => {
      const req = createMockReq({
        body: { ...validBody, name: '' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('バリデーションエラー: パスワードが弱い（記号なし）', async () => {
      const req = createMockReq({
        body: { ...validBody, password: 'WeakPass1' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('バリデーションエラー: パスワードが短い', async () => {
      const req = createMockReq({
        body: { ...validBody, password: 'Aa1!' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('メールアドレスは小文字に変換されること', async () => {
      mockTx.adminUser.count.mockResolvedValue(0);
      mockBcrypt.hash.mockResolvedValue('hashed');
      mockTx.adminUser.create.mockResolvedValue({
        id: 'id-1',
        email: 'test@example.com',
        name: 'Admin',
        role: 'SUPER_ADMIN',
        passwordHash: 'hashed',
      });
      mockTx.adminAuditLog.create.mockResolvedValue({});

      const req = createMockReq({
        body: {
          email: 'TEST@Example.COM',
          name: 'Admin',
          password: 'SecureP@ss1',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(mockTx.adminUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
    });

    it('トランザクションエラーの場合 next にエラーを渡す', async () => {
      mockBcrypt.hash.mockResolvedValue('hashed');
      const dbError = new Error('ユニーク制約違反');
      mockTx.adminUser.count.mockResolvedValue(0);
      mockTx.adminUser.create.mockRejectedValue(dbError);

      const req = createMockReq({ body: validBody });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
    });

    it('存在チェックと作成がトランザクション内で実行されること', async () => {
      mockTx.adminUser.count.mockResolvedValue(0);
      mockBcrypt.hash.mockResolvedValue('hashed');
      mockTx.adminUser.create.mockResolvedValue({
        id: 'id-1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'SUPER_ADMIN',
        passwordHash: 'hashed',
      });
      mockTx.adminAuditLog.create.mockResolvedValue({});

      const req = createMockReq({ body: validBody });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      // $transaction が呼ばれること
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // トランザクション内で count → create → auditLog の順で呼ばれること
      expect(mockTx.adminUser.count).toHaveBeenCalled();
      expect(mockTx.adminUser.create).toHaveBeenCalled();
      expect(mockTx.adminAuditLog.create).toHaveBeenCalled();
    });
  });
});
