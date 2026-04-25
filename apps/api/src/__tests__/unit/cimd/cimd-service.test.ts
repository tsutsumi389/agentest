import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OAuthClient } from '@agentest/db';
import { CimdService } from '../../../services/cimd/cimd-service.js';
import type { IOAuthRepository } from '../../../repositories/oauth.repository.js';

const URL = 'https://example.com/client/abc';

function makeClient(overrides: Partial<OAuthClient> = {}): OAuthClient {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    clientId: URL,
    clientSecret: null,
    clientSecretExpiresAt: null,
    clientIdIssuedAt: new Date('2026-04-01T00:00:00Z'),
    clientName: 'Example MCP',
    clientUri: null,
    logoUri: null,
    redirectUris: ['https://example.com/cb'],
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
    tokenEndpointAuthMethod: 'none',
    scopes: [],
    softwareId: null,
    softwareVersion: null,
    isActive: true,
    isCimd: true,
    metadataUrl: URL,
    metadataFetchedAt: new Date('2026-04-25T00:00:00Z'),
    metadataExpiresAt: new Date('2026-04-25T01:00:00Z'),
    metadataEtag: '"v1"',
    jwksUri: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-25T00:00:00Z'),
    ...overrides,
  };
}

describe('CimdService.resolveClient', () => {
  let repo: IOAuthRepository;
  let dcrClient: OAuthClient;

  beforeEach(() => {
    dcrClient = {
      ...makeClient(),
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      isCimd: false,
      metadataUrl: null,
      metadataFetchedAt: null,
      metadataExpiresAt: null,
      metadataEtag: null,
    };

    repo = {
      createClient: vi.fn(),
      findClientByClientId: vi.fn(),
      upsertCimdClient: vi.fn(),
      touchCimdClient: vi.fn(),
      createAuthorizationCode: vi.fn(),
      findAuthorizationCodeByCode: vi.fn(),
      markAuthorizationCodeAsUsed: vi.fn(),
      createAccessToken: vi.fn(),
      findAccessTokenByHash: vi.fn(),
      revokeAccessToken: vi.fn(),
      revokeAllAccessTokensByUserId: vi.fn(),
      createRefreshToken: vi.fn(),
      findRefreshTokenByHash: vi.fn(),
      revokeRefreshToken: vi.fn(),
      revokeAllRefreshTokensByUserId: vi.fn(),
    } as unknown as IOAuthRepository;
  });

  it('client_id が UUID の場合は DCR 経路 (findClientByClientId) を使う', async () => {
    (repo.findClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue(dcrClient);
    const fetcher = vi.fn();
    const service = new CimdService({
      repository: repo,
      fetcher,
      maxBytes: 5120,
      timeoutMs: 5000,
      defaultCacheTtlSec: 3600,
    });

    const result = await service.resolveClient('550e8400-e29b-41d4-a716-446655440000');

    expect(result).toBe(dcrClient);
    expect(fetcher).not.toHaveBeenCalled();
    expect(repo.upsertCimdClient).not.toHaveBeenCalled();
  });

  it('client_id が CIMD URL かつ DB 未存在ならフェッチして upsert', async () => {
    (repo.findClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      metadata: {
        client_id: URL,
        client_name: 'Example MCP',
        redirect_uris: ['https://example.com/cb'],
        token_endpoint_auth_method: 'none',
      },
      etag: '"v1"',
      expiresAt: new Date('2026-04-25T01:00:00Z'),
      fetchedAt: new Date('2026-04-25T00:00:00Z'),
    });
    const upserted = makeClient();
    (repo.upsertCimdClient as ReturnType<typeof vi.fn>).mockResolvedValue(upserted);

    const service = new CimdService({
      repository: repo,
      fetcher,
      maxBytes: 5120,
      timeoutMs: 5000,
      defaultCacheTtlSec: 3600,
    });

    const result = await service.resolveClient(URL);

    expect(fetcher).toHaveBeenCalledWith(URL, expect.objectContaining({ etag: undefined }));
    expect(repo.upsertCimdClient).toHaveBeenCalled();
    expect(result).toBe(upserted);
  });

  it('キャッシュ鮮度内なら DB 値を即返却し fetch を呼ばない', async () => {
    const fresh = makeClient({ metadataExpiresAt: new Date('2030-01-01T00:00:00Z') });
    (repo.findClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue(fresh);
    const fetcher = vi.fn();
    const service = new CimdService({
      repository: repo,
      fetcher,
      maxBytes: 5120,
      timeoutMs: 5000,
      defaultCacheTtlSec: 3600,
      now: () => new Date('2026-04-25T00:00:00Z'),
    });

    const result = await service.resolveClient(URL);

    expect(result).toBe(fresh);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('期限切れ DB 値があれば If-None-Match で再検証し、304 なら touchCimdClient', async () => {
    const stale = makeClient({
      metadataExpiresAt: new Date('2026-04-24T00:00:00Z'),
      metadataEtag: '"v1"',
    });
    (repo.findClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue(stale);
    const fetcher = vi.fn().mockResolvedValue({
      status: 304,
      metadata: null,
      etag: '"v1"',
      expiresAt: new Date('2026-04-25T01:00:00Z'),
      fetchedAt: new Date('2026-04-25T00:00:00Z'),
    });
    const touched = makeClient({ metadataFetchedAt: new Date('2026-04-25T00:00:00Z') });
    (repo.touchCimdClient as ReturnType<typeof vi.fn>).mockResolvedValue(touched);

    const service = new CimdService({
      repository: repo,
      fetcher,
      maxBytes: 5120,
      timeoutMs: 5000,
      defaultCacheTtlSec: 3600,
      now: () => new Date('2026-04-25T00:00:00Z'),
    });

    const result = await service.resolveClient(URL);

    expect(fetcher).toHaveBeenCalledWith(URL, expect.objectContaining({ etag: '"v1"' }));
    expect(repo.touchCimdClient).toHaveBeenCalled();
    expect(repo.upsertCimdClient).not.toHaveBeenCalled();
    expect(result).toBe(touched);
  });

  it('CIMD URL のメタデータ client_id が一致しない場合はエラー', async () => {
    (repo.findClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      metadata: {
        client_id: 'https://attacker.example.com/client',
        redirect_uris: ['https://example.com/cb'],
      },
      etag: undefined,
      expiresAt: new Date('2026-04-25T01:00:00Z'),
      fetchedAt: new Date('2026-04-25T00:00:00Z'),
    });
    const service = new CimdService({
      repository: repo,
      fetcher,
      maxBytes: 5120,
      timeoutMs: 5000,
      defaultCacheTtlSec: 3600,
    });

    await expect(service.resolveClient(URL)).rejects.toThrow();
    expect(repo.upsertCimdClient).not.toHaveBeenCalled();
  });

  it('並行リクエストは in-flight promise を共有する (同一URL)', async () => {
    (repo.findClientByClientId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const resolverHolder: { resolve?: (value: unknown) => void } = {};
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolverHolder.resolve = resolve as (value: unknown) => void;
        })
    );
    const upserted = makeClient();
    (repo.upsertCimdClient as ReturnType<typeof vi.fn>).mockResolvedValue(upserted);

    const service = new CimdService({
      repository: repo,
      fetcher,
      maxBytes: 5120,
      timeoutMs: 5000,
      defaultCacheTtlSec: 3600,
    });

    const p1 = service.resolveClient(URL);
    const p2 = service.resolveClient(URL);

    // 内部で findClientByClientId の await を経るためマイクロタスクを進める
    // (fetch が呼ばれるのは findClientByClientId 解決後の次のマイクロタスク)
    await Promise.resolve();
    await Promise.resolve();

    // 並行リクエストは in-flight promise を共有するため fetcher は 1 度しか呼ばれない
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolverHolder.resolve?.({
      status: 200,
      metadata: {
        client_id: URL,
        client_name: 'Example MCP',
        redirect_uris: ['https://example.com/cb'],
        token_endpoint_auth_method: 'none',
      },
      etag: '"v1"',
      expiresAt: new Date('2026-04-25T01:00:00Z'),
      fetchedAt: new Date('2026-04-25T00:00:00Z'),
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(upserted);
    expect(r2).toBe(upserted);
  });
});
