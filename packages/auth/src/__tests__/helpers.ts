import { vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { AuthConfig, JwtPayload } from '../types.js';

// テスト用の固定値
export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
export const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
export const TEST_PROJECT_ID = '33333333-3333-3333-3333-333333333333';
export const TEST_ACCESS_TOKEN = 'valid-access-token';

// テスト用の設定
export const testConfig: AuthConfig = {
  jwt: {
    accessSecret: 'test-access-secret',
    refreshSecret: 'test-refresh-secret',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
  },
  oauth: {},
};

// テスト用のJWTペイロード
export const testPayload: JwtPayload = {
  sub: TEST_USER_ID,
  email: 'test@example.com',
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
};

// テスト用のユーザー
export const testUser = {
  id: TEST_USER_ID,
  email: 'test@example.com',
  name: 'Test User',
  deletedAt: null,
};

// Express req, res, next のモック作成
export function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    params: {},
    body: {},
    user: undefined,
    token: undefined,
    ...overrides,
  } as Request;
}

export function createMockResponse(): Response {
  return {} as Response;
}

// NextFunction モックの型安全なヘルパー
export function createMockNext(): NextFunction & ReturnType<typeof vi.fn> {
  return vi.fn() as NextFunction & ReturnType<typeof vi.fn>;
}

// エラーメッセージを取得するヘルパー
export function getErrorFromMockNext(mockNext: ReturnType<typeof vi.fn>): Error | undefined {
  const calls = mockNext.mock.calls;
  if (calls.length > 0 && calls[0].length > 0) {
    return calls[0][0] as Error;
  }
  return undefined;
}
