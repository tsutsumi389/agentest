import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// envのモック
const mockEnv = vi.hoisted(() => ({
  API_INTERNAL_URL: 'http://api:3001',
  INTERNAL_API_SECRET: 'test-internal-api-secret-32characters',
}));

vi.mock('../../../config/env.js', () => ({
  env: mockEnv,
}));

// モック設定後にインポート
import { InternalApiClient, apiClient } from '../../../clients/api-client.js';

describe('InternalApiClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('get', () => {
    it('正常なレスポンスを返す', async () => {
      const mockResponse = { data: 'test' };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const client = new InternalApiClient();
      const result = await client.get('/test');

      expect(result).toEqual(mockResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://api:3001/test',
        {
          method: 'GET',
          headers: {
            'X-Internal-API-Key': 'test-internal-api-secret-32characters',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('クエリパラメータを正しく追加する', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const client = new InternalApiClient();
      await client.get('/test', { q: 'search', limit: 10 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('q=search'),
        expect.any(Object)
      );
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    it('undefinedのパラメータはスキップする', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const client = new InternalApiClient();
      await client.get('/test', { q: undefined, limit: 10 });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('q=');
      expect(calledUrl).toContain('limit=10');
    });

    it('配列パラメータを複数のクエリパラメータとして追加する', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const client = new InternalApiClient();
      await client.get('/test', { status: ['DRAFT', 'ACTIVE'] });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      // ?status=DRAFT&status=ACTIVE 形式になっていることを確認
      expect(calledUrl).toContain('status=DRAFT');
      expect(calledUrl).toContain('status=ACTIVE');
    });

    it('配列パラメータと通常パラメータを混在させられる', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const client = new InternalApiClient();
      await client.get('/test', {
        q: 'search',
        status: ['DRAFT', 'ACTIVE'],
        priority: ['HIGH', 'CRITICAL'],
        limit: 20,
      });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=search');
      expect(calledUrl).toContain('status=DRAFT');
      expect(calledUrl).toContain('status=ACTIVE');
      expect(calledUrl).toContain('priority=HIGH');
      expect(calledUrl).toContain('priority=CRITICAL');
      expect(calledUrl).toContain('limit=20');
    });

    it('空の配列パラメータはパラメータを追加しない', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const client = new InternalApiClient();
      await client.get('/test', { status: [], limit: 10 });

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('status=');
      expect(calledUrl).toContain('limit=10');
    });

    it('APIエラー時はエラーをスローする', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      } as Response);

      const client = new InternalApiClient();
      await expect(client.get('/test')).rejects.toThrow(
        'Internal API error: 403 - Forbidden'
      );
    });

    it('APIエラーでJSONパースが失敗した場合はUnknown errorを返す', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Parse error')),
      } as Response);

      const client = new InternalApiClient();
      await expect(client.get('/test')).rejects.toThrow(
        'Internal API error: 500 - Unknown error'
      );
    });

    it('ネットワークエラー時はエラーをスローする', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      const client = new InternalApiClient();
      await expect(client.get('/test')).rejects.toThrow('Network error');
    });
  });

  describe('シングルトンインスタンス', () => {
    it('apiClientがエクスポートされている', () => {
      expect(apiClient).toBeDefined();
      expect(apiClient).toBeInstanceOf(InternalApiClient);
    });
  });
});
