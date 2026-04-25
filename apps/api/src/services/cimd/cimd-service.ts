import type { OAuthClient } from '@agentest/db';
import { logger as baseLogger } from '../../utils/logger.js';
import { OAuthRepository, type IOAuthRepository } from '../../repositories/oauth.repository.js';
import { isCimdClientId, validateCimdUrl, CimdUrlError } from './cimd-url.js';
import { validateCimdMetadata, CimdValidationError } from './cimd-validator.js';
import {
  fetchCimdMetadata as defaultFetcher,
  CimdFetchError,
  type FetchCimdOptions,
  type FetchCimdResult,
} from './cimd-fetcher.js';

const logger = baseLogger.child({ module: 'cimd' });

export class CimdResolveError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'CimdResolveError';
  }
}

export type CimdFetcher = (url: string, opts: FetchCimdOptions) => Promise<FetchCimdResult>;

export interface CimdServiceOptions {
  repository?: IOAuthRepository;
  fetcher?: CimdFetcher;
  maxBytes: number;
  timeoutMs: number;
  defaultCacheTtlSec: number;
  /** 時刻ソース (テスト容易性) */
  now?: () => Date;
}

/**
 * CIMD クライアント解決サービス。
 *
 * - client_id が UUID なら DCR 経路 (findClientByClientId)
 * - client_id が CIMD URL ならキャッシュ参照→必要に応じてフェッチ＆upsert
 * - 並行 fetch は in-flight promise キャッシュで重複抑止
 */
export class CimdService {
  private readonly repository: IOAuthRepository;
  private readonly fetcher: CimdFetcher;
  private readonly maxBytes: number;
  private readonly timeoutMs: number;
  private readonly defaultCacheTtlSec: number;
  private readonly now: () => Date;
  // 同一 client_id への並行 resolve を共有するための in-flight キャッシュ
  private readonly inflight = new Map<string, Promise<OAuthClient>>();

  constructor(opts: CimdServiceOptions) {
    this.repository = opts.repository ?? new OAuthRepository();
    this.fetcher = opts.fetcher ?? defaultFetcher;
    this.maxBytes = opts.maxBytes;
    this.timeoutMs = opts.timeoutMs;
    this.defaultCacheTtlSec = opts.defaultCacheTtlSec;
    this.now = opts.now ?? (() => new Date());
  }

  /**
   * client_id を解決して有効な OAuthClient を返す。
   *
   * - 見つからない / 検証失敗 / フェッチ失敗 → CimdResolveError
   * - 既存有効キャッシュがあるフェッチ失敗時はフォールバックして既存値を返す
   */
  async resolveClient(clientId: string): Promise<OAuthClient> {
    if (!isCimdClientId(clientId)) {
      // DCR 経路 (UUID 形式または非 https URL → DCR にフォールバック)
      const client = await this.repository.findClientByClientId(clientId);
      if (!client) {
        throw new CimdResolveError('client not found (DCR path)');
      }
      return client;
    }

    // CIMD 経路: in-flight キャッシュで重複抑止
    const existing = this.inflight.get(clientId);
    if (existing) return existing;

    const promise = this.resolveCimdClient(clientId).finally(() => {
      this.inflight.delete(clientId);
    });
    this.inflight.set(clientId, promise);
    return promise;
  }

  private async resolveCimdClient(clientId: string): Promise<OAuthClient> {
    try {
      validateCimdUrl(clientId);
    } catch (err) {
      if (err instanceof CimdUrlError) {
        throw new CimdResolveError(`invalid CIMD URL: ${err.reason}`);
      }
      throw err;
    }

    const cached = await this.repository.findClientByClientId(clientId);
    const now = this.now();

    // 鮮度内ならキャッシュをそのまま返す
    if (cached && cached.metadataExpiresAt && cached.metadataExpiresAt.getTime() > now.getTime()) {
      logger.debug({ clientId }, 'CIMD cache hit (fresh)');
      return cached;
    }

    // 期限切れ or 未存在: fetch
    const etag = cached?.metadataEtag ?? undefined;
    let result: FetchCimdResult;
    try {
      result = await this.fetcher(clientId, {
        maxBytes: this.maxBytes,
        timeoutMs: this.timeoutMs,
        defaultCacheTtlSec: this.defaultCacheTtlSec,
        etag,
        now: this.now,
      });
    } catch (err) {
      // フォールバック: キャッシュがあればそれを返す (期限切れでも)
      if (cached) {
        const reason = err instanceof Error ? err.message : 'unknown';
        logger.warn({ clientId, reason }, 'CIMD fetch failed; falling back to stale cache');
        return cached;
      }
      if (err instanceof CimdFetchError) {
        throw new CimdResolveError(`CIMD fetch failed: ${err.reason}`);
      }
      throw err;
    }

    // 304 Not Modified: メタデータ本体は再利用、期限のみ更新
    if (result.status === 304) {
      if (!cached) {
        // ETag を渡したのに DB 上のキャッシュがないというのは異常状態
        throw new CimdResolveError('304 Not Modified but no cached metadata');
      }
      logger.debug({ clientId }, 'CIMD 304 Not Modified');
      return await this.repository.touchCimdClient({
        clientId,
        metadataFetchedAt: result.fetchedAt,
        metadataExpiresAt: result.expiresAt,
        metadataEtag: cached.metadataEtag ?? undefined,
      });
    }

    // 200 OK: メタデータ検証 → upsert
    let metadata;
    try {
      metadata = validateCimdMetadata(result.metadata, clientId);
    } catch (err) {
      if (err instanceof CimdValidationError) {
        throw new CimdResolveError(`CIMD metadata invalid: ${err.reason}`);
      }
      throw err;
    }

    return await this.repository.upsertCimdClient({
      clientId,
      clientName: metadata.client_name ?? clientId,
      redirectUris: metadata.redirect_uris,
      grantTypes: metadata.grant_types,
      responseTypes: metadata.response_types,
      tokenEndpointAuthMethod: metadata.token_endpoint_auth_method,
      scopes: metadata.scope ? metadata.scope.split(' ').filter(Boolean) : [],
      clientUri: metadata.client_uri,
      logoUri: metadata.logo_uri,
      softwareId: metadata.software_id,
      softwareVersion: metadata.software_version,
      jwksUri: metadata.jwks_uri,
      metadataFetchedAt: result.fetchedAt,
      metadataExpiresAt: result.expiresAt,
      metadataEtag: result.etag,
    });
  }
}
