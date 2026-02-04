import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '@agentest/shared';
import { requireOwnership } from '../../middleware/require-ownership.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    user: { id: TEST_USER_ID } as any,
    params: { userId: TEST_USER_ID },
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('requireOwnership', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  it('パラメータのuserIdと認証ユーザーが一致する場合はnextを呼ぶ', () => {
    const req = createMockRequest();
    const res = createMockResponse();

    const middleware = requireOwnership();
    middleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('パラメータのuserIdと認証ユーザーが一致しない場合はAuthorizationErrorを渡す', () => {
    const req = createMockRequest({
      params: { userId: OTHER_USER_ID },
    });
    const res = createMockResponse();

    const middleware = requireOwnership();
    middleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(error.message).toBe('このリソースにアクセスする権限がありません');
  });

  it('認証ユーザーが存在しない場合はAuthorizationErrorを渡す', () => {
    const req = createMockRequest({ user: undefined });
    const res = createMockResponse();

    const middleware = requireOwnership();
    middleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(error.message).toBe('認証が必要です');
  });

  it('カスタムparamNameを指定できる', () => {
    const req = createMockRequest({
      params: { targetUserId: TEST_USER_ID },
    });
    const res = createMockResponse();

    const middleware = requireOwnership('targetUserId');
    middleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('カスタムparamNameで不一致の場合はAuthorizationErrorを渡す', () => {
    const req = createMockRequest({
      params: { targetUserId: OTHER_USER_ID },
    });
    const res = createMockResponse();

    const middleware = requireOwnership('targetUserId');
    middleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('パラメータが存在しない場合はAuthorizationErrorを渡す', () => {
    const req = createMockRequest({
      params: {},
    });
    const res = createMockResponse();

    const middleware = requireOwnership();
    middleware(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });
});
