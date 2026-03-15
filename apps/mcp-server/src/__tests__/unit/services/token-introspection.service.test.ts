import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// loggerのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// 環境変数のモック
vi.mock('../../../config/env.js', () => ({
  env: {
    MCP_SERVER_URL: 'http://localhost:3002',
    API_URL: 'http://localhost:3001',
    API_INTERNAL_URL: 'http://localhost:3001',
    INTERNAL_API_SECRET: 'test-internal-secret',
    NODE_ENV: 'test',
  },
}));

// トークンキャッシュのモック
const { mockGetCachedTokenValidation, mockCacheTokenValidation } = vi.hoisted(() => ({
  mockGetCachedTokenValidation: vi.fn(),
  mockCacheTokenValidation: vi.fn(),
}));

vi.mock('../../../lib/token-cache.js', () => ({
  getCachedTokenValidation: mockGetCachedTokenValidation,
  cacheTokenValidation: mockCacheTokenValidation,
}));

// fetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

// モック設定後にインポート
import { TokenIntrospectionService } from '../../../services/token-introspection.service.js';

describe('TokenIntrospectionService', () => {
  let service: TokenIntrospectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TokenIntrospectionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('introspect', () => {
    it('正常なイントロスペクションレスポンスを返す', async () => {
      const mockResponse = {
        active: true,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        sub: 'user-123',
        scope: 'mcp:read mcp:write',
        aud: 'http://localhost:3002',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.introspect('valid-token');

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/oauth/introspect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Api-Key': 'test-internal-secret',
        },
        body: JSON.stringify({ token: 'valid-token' }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('イントロスペクション失敗時はactive: falseを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.introspect('invalid-token');

      expect(result).toEqual({ active: false });
    });

    it('ネットワークエラー時はactive: falseを返す', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await service.introspect('some-token');

      expect(result).toEqual({ active: false });
    });
  });

  describe('validateToken', () => {
    it('有効なトークンでvalid: trueを返す', async () => {
      const mockResponse = {
        active: true,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        sub: 'user-123',
        scope: 'mcp:read mcp:write',
        aud: 'http://localhost:3002',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.validateToken('valid-token', 'http://localhost:3002');

      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
        scopes: ['mcp:read', 'mcp:write'],
      });
    });

    it('無効なトークンでvalid: falseを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ active: false }),
      });

      const result = await service.validateToken('invalid-token');

      expect(result).toEqual({ valid: false });
    });

    it('Audience不一致でvalid: falseを返す', async () => {
      const mockResponse = {
        active: true,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        sub: 'user-123',
        scope: 'mcp:read',
        aud: 'http://different-audience:3002',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.validateToken('valid-token', 'http://localhost:3002');

      expect(result).toEqual({ valid: false });
    });

    it('Audienceが指定されていない場合は検証をスキップ', async () => {
      const mockResponse = {
        active: true,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        sub: 'user-123',
        scope: 'mcp:read',
        aud: 'http://any-audience:3002',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.validateToken('valid-token');

      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
        scopes: ['mcp:read'],
      });
    });

    it('スコープが空文字列の場合は空配列を返す', async () => {
      const mockResponse = {
        active: true,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        sub: 'user-123',
        scope: '',
        aud: 'http://localhost:3002',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.validateToken('valid-token', 'http://localhost:3002');

      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
        scopes: [],
      });
    });

    it('スコープがない場合は空配列を返す', async () => {
      const mockResponse = {
        active: true,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        sub: 'user-123',
        aud: 'http://localhost:3002',
        // scopeフィールドなし
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.validateToken('valid-token', 'http://localhost:3002');

      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
        scopes: [],
      });
    });
  });

  describe('validateToken - キャッシュ統合', () => {
    it('キャッシュヒット時はAPIコールをスキップする', async () => {
      const cachedResult = { userId: 'user-123', scopes: ['mcp:read', 'mcp:write'] };
      mockGetCachedTokenValidation.mockResolvedValue(cachedResult);

      const result = await service.validateToken('cached-token');

      expect(result).toEqual({ valid: true, ...cachedResult });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockGetCachedTokenValidation).toHaveBeenCalledWith('oauth', 'cached-token');
    });

    it('キャッシュミス時はAPIコールを実行してキャッシュに保存する', async () => {
      mockGetCachedTokenValidation.mockResolvedValue(null);

      const expTime = Math.floor(Date.now() / 1000) + 200;
      const mockResponse = {
        active: true,
        sub: 'user-456',
        scope: 'mcp:read',
        aud: 'http://localhost:3002',
        exp: expTime,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.validateToken('uncached-token', 'http://localhost:3002');

      expect(result).toEqual({
        valid: true,
        userId: 'user-456',
        scopes: ['mcp:read'],
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // キャッシュに保存されることを確認（TTLは min(残存期間, 300) ）
      expect(mockCacheTokenValidation).toHaveBeenCalledWith(
        'oauth',
        'uncached-token',
        { userId: 'user-456', scopes: ['mcp:read'] },
        expect.any(Number)
      );
      // TTLは200秒以下（残存期間）であること
      const actualTtl = mockCacheTokenValidation.mock.calls[0][3];
      expect(actualTtl).toBeLessThanOrEqual(200);
      expect(actualTtl).toBeGreaterThan(0);
    });

    it('無効なトークンはキャッシュに保存しない', async () => {
      mockGetCachedTokenValidation.mockResolvedValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ active: false }),
      });

      const result = await service.validateToken('invalid-token');

      expect(result).toEqual({ valid: false });
      expect(mockCacheTokenValidation).not.toHaveBeenCalled();
    });

    it('expがないOAuthトークンはデフォルトTTL(300秒)でキャッシュする', async () => {
      mockGetCachedTokenValidation.mockResolvedValue(null);

      const mockResponse = {
        active: true,
        sub: 'user-789',
        scope: 'mcp:read',
        // exp なし
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.validateToken('no-exp-token');

      expect(result.valid).toBe(true);
      expect(mockCacheTokenValidation).toHaveBeenCalledWith(
        'oauth',
        'no-exp-token',
        { userId: 'user-789', scopes: ['mcp:read'] },
        300
      );
    });
  });
});
