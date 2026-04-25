import { describe, it, expect, vi } from 'vitest';
import { fetchCimdMetadata, CimdFetchError } from '../../../services/cimd/cimd-fetcher.js';
import type { SafeFetchTransport } from '../../../utils/safe-fetch.js';

const URL = 'https://example.com/client/abc';

const makeOpts = (override: Partial<Parameters<typeof fetchCimdMetadata>[1]> = {}) => ({
  maxBytes: 5 * 1024,
  timeoutMs: 5000,
  defaultCacheTtlSec: 3600,
  dnsLookup: vi.fn().mockResolvedValue(['8.8.8.8']),
  transport: vi.fn() as unknown as SafeFetchTransport,
  now: () => new Date('2026-04-25T00:00:00Z'),
  ...override,
});

describe('fetchCimdMetadata', () => {
  describe('200 OK', () => {
    it('JSON ボディを返し ETag/expiresAt を抽出する', async () => {
      const transport = vi.fn().mockResolvedValue({
        status: 200,
        headers: {
          'content-type': 'application/json',
          etag: '"abc"',
          'cache-control': 'max-age=600',
        },
        body: Buffer.from(
          JSON.stringify({ client_id: URL, redirect_uris: ['https://example.com/cb'] })
        ),
      });
      const result = await fetchCimdMetadata(URL, makeOpts({ transport: transport as never }));

      expect(result.status).toBe(200);
      expect(result.metadata).toMatchObject({ client_id: URL });
      expect(result.etag).toBe('"abc"');
      // 2026-04-25T00:00:00Z + 600s
      expect(result.expiresAt?.toISOString()).toBe('2026-04-25T00:10:00.000Z');
    });

    it('Cache-Control: no-store の場合は expiresAt は now と等しい (毎回再検証)', async () => {
      const now = new Date('2026-04-25T00:00:00Z');
      const transport = vi.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        body: Buffer.from(
          JSON.stringify({ client_id: URL, redirect_uris: ['https://example.com/cb'] })
        ),
      });

      const result = await fetchCimdMetadata(
        URL,
        makeOpts({ transport: transport as never, now: () => now })
      );

      expect(result.expiresAt?.getTime()).toBe(now.getTime());
    });

    it('Cache-Control ヘッダ無しの場合は defaultCacheTtlSec を使う', async () => {
      const now = new Date('2026-04-25T00:00:00Z');
      const transport = vi.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(
          JSON.stringify({ client_id: URL, redirect_uris: ['https://example.com/cb'] })
        ),
      });

      const result = await fetchCimdMetadata(
        URL,
        makeOpts({ transport: transport as never, now: () => now, defaultCacheTtlSec: 7200 })
      );

      expect(result.expiresAt?.toISOString()).toBe('2026-04-25T02:00:00.000Z');
    });

    it('JSON パースに失敗した場合は CimdFetchError', async () => {
      const transport = vi.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from('not-a-json'),
      });
      await expect(
        fetchCimdMetadata(URL, makeOpts({ transport: transport as never }))
      ).rejects.toThrow(CimdFetchError);
    });
  });

  describe('304 Not Modified', () => {
    it('etag を渡して 304 が返ったら status=304 を返す', async () => {
      const transport = vi.fn().mockResolvedValue({
        status: 304,
        headers: {},
        body: null,
      });

      const result = await fetchCimdMetadata(
        URL,
        makeOpts({ transport: transport as never, etag: '"abc"' })
      );

      expect(result.status).toBe(304);
      expect(result.metadata).toBeNull();
      // If-None-Match ヘッダが渡されていることを確認
      const callArg = transport.mock.calls[0][0];
      expect(callArg.headers['If-None-Match']).toBe('"abc"');
    });
  });

  describe('4xx/5xx', () => {
    it('404 の場合は CimdFetchError(notFound) を投げる', async () => {
      const transport = vi.fn().mockResolvedValue({
        status: 404,
        headers: {},
        body: null,
      });
      await expect(
        fetchCimdMetadata(URL, makeOpts({ transport: transport as never }))
      ).rejects.toThrow(/404/);
    });

    it('500 の場合も CimdFetchError', async () => {
      const transport = vi.fn().mockResolvedValue({
        status: 500,
        headers: {},
        body: null,
      });
      await expect(
        fetchCimdMetadata(URL, makeOpts({ transport: transport as never }))
      ).rejects.toThrow(CimdFetchError);
    });
  });
});
