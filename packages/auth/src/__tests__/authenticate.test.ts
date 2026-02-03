import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticationError } from '@agentest/shared';

// Prismaのモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: mockPrismaUser,
  },
}));

// JWTモジュールのモック
const mockVerifyAccessToken = vi.hoisted(() => vi.fn());

vi.mock('../jwt.js', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

// モック設定後にインポート
import { authenticate, requireAuth, optionalAuth } from '../middleware.js';
import {
  TEST_ACCESS_TOKEN,
  testConfig,
  testPayload,
  testUser,
  createMockRequest,
  createMockResponse,
  createMockNext,
  getErrorFromMockNext,
} from './helpers.js';

describe('authenticate', () => {
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = createMockNext();
  });

  describe('トークン抽出', () => {
    it('Authorizationヘッダーからトークンを抽出する', async () => {
      mockVerifyAccessToken.mockReturnValue(testPayload);
      mockPrismaUser.findUnique.mockResolvedValue(testUser);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig });

      await middleware(req, res, mockNext);

      expect(mockVerifyAccessToken).toHaveBeenCalledWith(
        TEST_ACCESS_TOKEN,
        testConfig
      );
    });

    it('クッキーからトークンを抽出する', async () => {
      mockVerifyAccessToken.mockReturnValue(testPayload);
      mockPrismaUser.findUnique.mockResolvedValue(testUser);

      const req = createMockRequest({
        cookies: { access_token: TEST_ACCESS_TOKEN },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig });

      await middleware(req, res, mockNext);

      expect(mockVerifyAccessToken).toHaveBeenCalledWith(
        TEST_ACCESS_TOKEN,
        testConfig
      );
    });

    it('Authorizationヘッダーがクッキーより優先される', async () => {
      mockVerifyAccessToken.mockReturnValue(testPayload);
      mockPrismaUser.findUnique.mockResolvedValue(testUser);

      const req = createMockRequest({
        headers: { authorization: 'Bearer header-token' },
        cookies: { access_token: 'cookie-token' },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig });

      await middleware(req, res, mockNext);

      expect(mockVerifyAccessToken).toHaveBeenCalledWith(
        'header-token',
        testConfig
      );
    });
  });

  describe('必須認証 (optional: false)', () => {
    it('有効なトークンでユーザーを設定しnextを呼ぶ', async () => {
      mockVerifyAccessToken.mockReturnValue(testPayload);
      mockPrismaUser.findUnique.mockResolvedValue(testUser);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig, optional: false });

      await middleware(req, res, mockNext);

      expect(req.user).toEqual(testUser);
      expect(req.token).toEqual(testPayload);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('トークンがない場合エラーをnextに渡す', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig, optional: false });

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = getErrorFromMockNext(mockNext);
      expect(error?.message).toBe('No authentication token provided');
    });

    it('無効なトークンでエラーをnextに渡す', async () => {
      mockVerifyAccessToken.mockImplementation(() => {
        throw new AuthenticationError('Invalid token');
      });

      const req = createMockRequest({
        headers: { authorization: `Bearer invalid-token` },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig, optional: false });

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('ユーザーが見つからない場合エラーをnextに渡す', async () => {
      mockVerifyAccessToken.mockReturnValue(testPayload);
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig, optional: false });

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = getErrorFromMockNext(mockNext);
      expect(error?.message).toBe('User not found');
    });

    it('削除済みユーザーの場合エラーをnextに渡す', async () => {
      mockVerifyAccessToken.mockReturnValue(testPayload);
      mockPrismaUser.findUnique.mockResolvedValue({
        ...testUser,
        deletedAt: new Date(),
      });

      const req = createMockRequest({
        headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig, optional: false });

      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = getErrorFromMockNext(mockNext);
      expect(error?.message).toBe('User not found');
    });
  });

  describe('任意認証 (optional: true)', () => {
    it('トークンがない場合はユーザーなしでnextを呼ぶ', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig, optional: true });

      await middleware(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('無効なトークンでもユーザーなしでnextを呼ぶ', async () => {
      mockVerifyAccessToken.mockImplementation(() => {
        throw new AuthenticationError('Invalid token');
      });

      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig, optional: true });

      await middleware(req, res, mockNext);

      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('有効なトークンではユーザーを設定する', async () => {
      mockVerifyAccessToken.mockReturnValue(testPayload);
      mockPrismaUser.findUnique.mockResolvedValue(testUser);

      const req = createMockRequest({
        headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
      });
      const res = createMockResponse();
      const middleware = authenticate({ config: testConfig, optional: true });

      await middleware(req, res, mockNext);

      expect(req.user).toEqual(testUser);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});

describe('requireAuth', () => {
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = createMockNext();
  });

  it('optional: falseでauthenticateを呼ぶ', async () => {
    mockVerifyAccessToken.mockReturnValue(testPayload);
    mockPrismaUser.findUnique.mockResolvedValue(testUser);

    const req = createMockRequest({
      headers: { authorization: `Bearer ${TEST_ACCESS_TOKEN}` },
    });
    const res = createMockResponse();
    const middleware = requireAuth(testConfig);

    await middleware(req, res, mockNext);

    expect(req.user).toEqual(testUser);
  });
});

describe('optionalAuth', () => {
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = createMockNext();
  });

  it('optional: trueでauthenticateを呼ぶ', async () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const middleware = optionalAuth(testConfig);

    await middleware(req, res, mockNext);

    expect(req.user).toBeUndefined();
    expect(mockNext).toHaveBeenCalledWith();
  });
});
