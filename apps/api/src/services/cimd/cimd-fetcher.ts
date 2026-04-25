import { safeFetchJson, headerString, type SafeFetchTransport } from '../../utils/safe-fetch.js';

/**
 * CIMD (Client ID Metadata Document) ドキュメントの取得層。
 *
 * - HTTP fetch (SSRF対策込み)
 * - ETag / Cache-Control の解釈
 * - 304 Not Modified の扱い
 * - レスポンスボディ JSON のパース (検証は cimd-validator が担当)
 */

export class CimdFetchError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CimdFetchError';
  }
}

export interface FetchCimdOptions {
  maxBytes: number;
  timeoutMs: number;
  /** Cache-Control ヘッダがない場合に使うTTL (秒) */
  defaultCacheTtlSec: number;
  /** 既存キャッシュの ETag (条件付きリクエスト用) */
  etag?: string;
  /** 時刻ソース (テスト容易性) */
  now?: () => Date;
  /** テスト用: DNS lookup インジェクション */
  dnsLookup?: (hostname: string) => Promise<string[]>;
  /** テスト用: トランスポートインジェクション */
  transport?: SafeFetchTransport;
}

export interface FetchCimdResult {
  /** HTTP ステータス (200 or 304) */
  status: 200 | 304;
  /** 200 の場合のみメタデータ JSON。304 の場合は null */
  metadata: unknown;
  /** レスポンスから抽出した ETag (なければ undefined) */
  etag?: string;
  /** Cache-Control から算出したキャッシュ期限 */
  expiresAt: Date | null;
  /** フェッチ完了時刻 (now()) */
  fetchedAt: Date;
}

export async function fetchCimdMetadata(
  url: string,
  opts: FetchCimdOptions
): Promise<FetchCimdResult> {
  const now = (opts.now ?? (() => new Date()))();
  const headers: Record<string, string> = {};
  if (opts.etag) {
    headers['If-None-Match'] = opts.etag;
  }

  let response;
  try {
    response = await safeFetchJson(url, {
      maxBytes: opts.maxBytes,
      timeoutMs: opts.timeoutMs,
      headers,
      dnsLookup: opts.dnsLookup,
      transport: opts.transport,
    });
  } catch (err) {
    if (err instanceof Error) {
      throw new CimdFetchError(`fetch failed: ${err.message}`);
    }
    throw new CimdFetchError('fetch failed');
  }

  if (response.status === 304) {
    return {
      status: 304,
      metadata: null,
      etag: opts.etag,
      expiresAt: computeExpiresAt(
        headerString(response.headers['cache-control']),
        opts.defaultCacheTtlSec,
        now
      ),
      fetchedAt: now,
    };
  }

  if (response.status !== 200) {
    throw new CimdFetchError(`unexpected HTTP status ${response.status}`);
  }

  if (!response.body) {
    throw new CimdFetchError('200 OK but empty body');
  }

  let metadata: unknown;
  try {
    metadata = JSON.parse(response.body.toString('utf-8'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    throw new CimdFetchError(`JSON parse error: ${reason}`);
  }

  return {
    status: 200,
    metadata,
    etag: headerString(response.headers['etag']),
    expiresAt: computeExpiresAt(
      headerString(response.headers['cache-control']),
      opts.defaultCacheTtlSec,
      now
    ),
    fetchedAt: now,
  };
}

/**
 * Cache-Control から有効期限を算出する。
 *
 * - no-store → now と等しい (即時期限切れ)
 * - max-age=N → now + N秒
 * - いずれもなければ → now + defaultTtlSec秒
 */
function computeExpiresAt(
  cacheControl: string | undefined,
  defaultTtlSec: number,
  now: Date
): Date {
  const lower = cacheControl?.toLowerCase();
  if (lower && /(^|,\s*)no-store(\s*,|$)/.test(lower)) {
    return new Date(now.getTime());
  }
  const match = lower ? /max-age\s*=\s*(\d+)/.exec(lower) : null;
  const ttlSec = match ? Number.parseInt(match[1], 10) : defaultTtlSec;
  return new Date(now.getTime() + ttlSec * 1000);
}
