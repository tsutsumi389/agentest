import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// loggerのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// env のモック（インポート前にモックする必要がある）
vi.mock('../../../config/env.js', () => ({
  env: {
    API_INTERNAL_URL: 'http://localhost:3000',
    INTERNAL_API_SECRET: 'test-internal-secret',
  },
}));

// fetch のグローバルモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

// モック設定後にインポート
import { apiKeyAuthService } from '../../../services/api-key-auth.service.js';

describe('ApiKeyAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToken', () => {
    it('無効なプレフィックスのトークンはvalid: falseを返す（APIを呼び出さない）', async () => {
      const result = await apiKeyAuthService.validateToken('invalid_token');

      expect(result.valid).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('短すぎるトークンはvalid: falseを返す（APIを呼び出さない）', async () => {
      const result = await apiKeyAuthService.validateToken('agentest_short');

      expect(result.valid).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('プレフィックスはあるが最小長に満たないトークンはvalid: falseを返す', async () => {
      // agentest_ (9文字) + 30文字 = 39文字（MIN_TOKEN_LENGTHの41文字より短い）
      const result = await apiKeyAuthService.validateToken('agentest_' + 'a'.repeat(30));

      expect(result.valid).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('有効な形式のトークンでAPI検証成功', async () => {
      const mockResponse = {
        valid: true,
        userId: 'user-1',
        scopes: ['*'],
        tokenId: 'token-1',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const token = 'agentest_' + 'a'.repeat(43);
      const result = await apiKeyAuthService.validateToken(token);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/internal/api/api-token/validate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Api-Key': 'test-internal-secret',
          },
          body: JSON.stringify({ token }),
        }
      );
    });

    it('API検証で無効なトークンの場合はvalid: falseを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ valid: false }),
      });

      const result = await apiKeyAuthService.validateToken('agentest_' + 'a'.repeat(43));

      expect(result.valid).toBe(false);
    });

    it('APIがエラーステータスを返した場合はvalid: falseを返す', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });

      const result = await apiKeyAuthService.validateToken('agentest_' + 'a'.repeat(43));

      expect(result.valid).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { statusCode: 500 },
        'APIキー検証エラー'
      );
    });

    it('ネットワークエラーの場合はvalid: falseを返す', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await apiKeyAuthService.validateToken('agentest_' + 'a'.repeat(43));

      expect(result.valid).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'APIキー検証中にエラーが発生'
      );
    });

    it('組織IDを含む検証結果を正しく返す', async () => {
      const mockResponse = {
        valid: true,
        userId: null,
        organizationId: 'org-1',
        scopes: ['mcp:read'],
        tokenId: 'token-2',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiKeyAuthService.validateToken('agentest_' + 'a'.repeat(43));

      expect(result).toEqual(mockResponse);
      expect(result.organizationId).toBe('org-1');
    });
  });
});
