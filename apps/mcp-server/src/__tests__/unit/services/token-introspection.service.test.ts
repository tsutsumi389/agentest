import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 環境変数のモック
vi.mock('../../../config/env.js', () => ({
  env: {
    MCP_SERVER_URL: 'http://localhost:3002',
    AUTH_SERVER_URL: 'http://localhost:3001',
    INTERNAL_API_SECRET: 'test-internal-secret',
    NODE_ENV: 'test',
  },
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

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/oauth/introspect',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Api-Key': 'test-internal-secret',
          },
          body: JSON.stringify({ token: 'valid-token' }),
        }
      );
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
});
