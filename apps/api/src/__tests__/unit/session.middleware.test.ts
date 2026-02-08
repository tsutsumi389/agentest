import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Prismaのモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaSession = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    session: mockPrismaSession,
  },
}));

// SessionServiceのモック
const mockSessionService = vi.hoisted(() => ({
  updateSessionActivity: vi.fn(),
}));

vi.mock('../../services/session.service.js', () => ({
  SessionService: vi.fn().mockImplementation(() => mockSessionService),
}));

// モック設定後にインポート
import { trackSession, extractClientInfo } from '../../middleware/session.middleware.js';
import { hashToken } from '../../utils/pkce.js';

// テスト用の固定値
const TEST_SESSION_ID = '11111111-1111-1111-1111-111111111111';
const TEST_REFRESH_TOKEN = 'test-refresh-token-123';
const TEST_USER_ID = '22222222-2222-2222-2222-222222222222';

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    cookies: {},
    user: undefined,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' } as any,
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('trackSession', () => {
  let mockNext: NextFunction;
  let middleware: ReturnType<typeof trackSession>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
    middleware = trackSession();
  });

  describe('セッション特定', () => {
    it('クッキーのrefresh_tokenをハッシュ化してセッションを検索', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      mockPrismaSession.findUnique.mockResolvedValue({
        id: TEST_SESSION_ID,
        tokenHash: 'hashed-token',
        revokedAt: null,
        expiresAt: futureDate,
      });

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockPrismaSession.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashToken(TEST_REFRESH_TOKEN) },
      });
    });

    it('有効なセッションの場合req.sessionIdを設定', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      mockPrismaSession.findUnique.mockResolvedValue({
        id: TEST_SESSION_ID,
        tokenHash: 'hashed-token',
        revokedAt: null,
        expiresAt: futureDate,
      });

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(req.sessionId).toBe(TEST_SESSION_ID);
      expect(mockNext).toHaveBeenCalled();
    });

    it('失効済みセッションはスキップ', async () => {
      mockPrismaSession.findUnique.mockResolvedValue({
        id: TEST_SESSION_ID,
        tokenHash: 'hashed-token',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(req.sessionId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('期限切れセッションはスキップ', async () => {
      mockPrismaSession.findUnique.mockResolvedValue({
        id: TEST_SESSION_ID,
        tokenHash: 'hashed-token',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // 過去の日時
      });

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(req.sessionId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('トークンがない場合はスキップ', async () => {
      const req = createMockRequest({
        cookies: {},
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockPrismaSession.findUnique).not.toHaveBeenCalled();
      expect(req.sessionId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('セッションが見つからない場合はスキップ', async () => {
      mockPrismaSession.findUnique.mockResolvedValue(null);

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(req.sessionId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('活動時刻更新', () => {
    it('認証済みリクエストで最終活動時刻を更新', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      mockPrismaSession.findUnique.mockResolvedValue({
        id: TEST_SESSION_ID,
        tokenHash: 'hashed-token',
        revokedAt: null,
        expiresAt: futureDate,
      });
      mockSessionService.updateSessionActivity.mockResolvedValue(undefined);

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
        user: { id: TEST_USER_ID } as any,
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockSessionService.updateSessionActivity).toHaveBeenCalledWith(TEST_SESSION_ID);
    });

    it('未認証リクエストでは活動時刻を更新しない', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      mockPrismaSession.findUnique.mockResolvedValue({
        id: TEST_SESSION_ID,
        tokenHash: 'hashed-token',
        revokedAt: null,
        expiresAt: futureDate,
      });

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
        user: undefined,
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockSessionService.updateSessionActivity).not.toHaveBeenCalled();
    });

    it('更新エラーは無視して処理を継続', async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      mockPrismaSession.findUnique.mockResolvedValue({
        id: TEST_SESSION_ID,
        tokenHash: 'hashed-token',
        revokedAt: null,
        expiresAt: futureDate,
      });
      mockSessionService.updateSessionActivity.mockRejectedValue(new Error('Update failed'));

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
        user: { id: TEST_USER_ID } as any,
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.sessionId).toBe(TEST_SESSION_ID);
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーが発生しても処理を継続', async () => {
      mockPrismaSession.findUnique.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('extractClientInfo', () => {
  it('User-Agentヘッダーを取得', () => {
    const req = createMockRequest({
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    const result = extractClientInfo(req as Request);

    expect(result.userAgent).toBe('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  });

  it('X-Forwarded-Forから最初のIPを取得', () => {
    const req = createMockRequest({
      headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1, 192.0.2.1' },
    });

    const result = extractClientInfo(req as Request);

    expect(result.ipAddress).toBe('203.0.113.1');
  });

  it('直接接続のIPを取得', () => {
    const req = createMockRequest({
      headers: {},
      socket: { remoteAddress: '192.168.1.100' } as any,
    });

    const result = extractClientInfo(req as Request);

    expect(result.ipAddress).toBe('192.168.1.100');
  });

  it('配列形式のX-Forwarded-Forを処理', () => {
    const req = createMockRequest({
      headers: { 'x-forwarded-for': ['203.0.113.1', '198.51.100.1'] },
    });

    const result = extractClientInfo(req as Request);

    expect(result.ipAddress).toBe('203.0.113.1');
  });

  it('User-Agentがない場合はundefined', () => {
    const req = createMockRequest({
      headers: {},
    });

    const result = extractClientInfo(req as Request);

    expect(result.userAgent).toBeUndefined();
  });

  it('IPアドレスがない場合はundefined', () => {
    const req = createMockRequest({
      headers: {},
      socket: {} as any,
    });

    const result = extractClientInfo(req as Request);

    expect(result.ipAddress).toBeUndefined();
  });

  it('X-Forwarded-ForのIPにスペースがある場合はトリム', () => {
    const req = createMockRequest({
      headers: { 'x-forwarded-for': '  203.0.113.1  , 198.51.100.1' },
    });

    const result = extractClientInfo(req as Request);

    expect(result.ipAddress).toBe('203.0.113.1');
  });
});
