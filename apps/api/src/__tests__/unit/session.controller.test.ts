import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { SessionController } from '../../controllers/session.controller.js';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
} from '@agentest/shared';

// SessionService のモック
const mockSessionService = {
  createSession: vi.fn(),
  getSessionByToken: vi.fn(),
  getUserSessions: vi.fn(),
  updateSessionActivity: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeAllSessions: vi.fn(),
  getActiveSessionCount: vi.fn(),
  cleanupExpiredSessions: vi.fn(),
};

vi.mock('../../services/session.service.js', () => ({
  SessionService: vi.fn().mockImplementation(() => mockSessionService),
}));

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: 'user-1', email: 'test@example.com' } as any,
  sessionId: 'current-session-id',
  params: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext: NextFunction = vi.fn();

describe('SessionController', () => {
  let controller: SessionController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SessionController();
  });

  describe('getSessions', () => {
    it('認証済みユーザーのセッション一覧を取得できる', async () => {
      const mockSessions = [
        { id: 'session-1', userAgent: 'Chrome', isCurrent: true },
        { id: 'session-2', userAgent: 'Firefox', isCurrent: false },
      ];
      mockSessionService.getUserSessions.mockResolvedValue(mockSessions);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getSessions(req, res, mockNext);

      expect(mockSessionService.getUserSessions).toHaveBeenCalledWith(
        'user-1',
        'current-session-id'
      );
      expect(res.json).toHaveBeenCalledWith({ data: mockSessions });
    });

    it('未認証の場合はエラーをnextに渡す', async () => {
      const req = mockRequest({ user: undefined }) as Request;
      const res = mockResponse() as Response;

      await controller.getSessions(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('revokeSession', () => {
    it('特定のセッションを終了できる', async () => {
      mockSessionService.revokeSession.mockResolvedValue({ success: true });

      const req = mockRequest({
        params: { sessionId: 'session-to-revoke' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.revokeSession(req, res, mockNext);

      expect(mockSessionService.revokeSession).toHaveBeenCalledWith('user-1', 'session-to-revoke');
      expect(res.json).toHaveBeenCalledWith({ data: { success: true } });
    });

    it('現在のセッションは終了できない', async () => {
      const req = mockRequest({
        params: { sessionId: 'current-session-id' }, // 現在のセッション
      }) as Request;
      const res = mockResponse() as Response;

      await controller.revokeSession(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(mockSessionService.revokeSession).not.toHaveBeenCalled();
    });

    it('未認証の場合はエラーをnextに渡す', async () => {
      const req = mockRequest({ user: undefined }) as Request;
      const res = mockResponse() as Response;

      await controller.revokeSession(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('セッションIDがない場合はエラーをnextに渡す', async () => {
      const req = mockRequest({
        params: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.revokeSession(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('存在しないセッションはエラーをnextに渡す', async () => {
      mockSessionService.revokeSession.mockRejectedValue(new NotFoundError('Session', 'invalid'));

      const req = mockRequest({
        params: { sessionId: 'invalid-session' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.revokeSession(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
    });

    it('他ユーザーのセッション終了はエラーをnextに渡す', async () => {
      mockSessionService.revokeSession.mockRejectedValue(
        new AuthorizationError('他のユーザーのセッション')
      );

      const req = mockRequest({
        params: { sessionId: 'other-user-session' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.revokeSession(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });
  });

  describe('revokeOtherSessions', () => {
    it('他の全セッションを終了できる', async () => {
      mockSessionService.revokeOtherSessions.mockResolvedValue({ success: true, revokedCount: 3 });

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.revokeOtherSessions(req, res, mockNext);

      expect(mockSessionService.revokeOtherSessions).toHaveBeenCalledWith(
        'user-1',
        'current-session-id'
      );
      expect(res.json).toHaveBeenCalledWith({ data: { success: true, revokedCount: 3 } });
    });

    it('未認証の場合はエラーをnextに渡す', async () => {
      const req = mockRequest({ user: undefined }) as Request;
      const res = mockResponse() as Response;

      await controller.revokeOtherSessions(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('現在のセッションIDがない場合はエラーをnextに渡す', async () => {
      const req = mockRequest({ sessionId: undefined }) as Request;
      const res = mockResponse() as Response;

      await controller.revokeOtherSessions(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('getSessionCount', () => {
    it('有効なセッション数を取得できる', async () => {
      mockSessionService.getActiveSessionCount.mockResolvedValue(5);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getSessionCount(req, res, mockNext);

      expect(mockSessionService.getActiveSessionCount).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({ data: { count: 5 } });
    });

    it('未認証の場合はエラーをnextに渡す', async () => {
      const req = mockRequest({ user: undefined }) as Request;
      const res = mockResponse() as Response;

      await controller.getSessionCount(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });
});
