import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import { createTestUser, cleanupTestData } from './test-helpers.js';
import { AuthenticationError } from '@agentest/shared';

// CIMD クライアントは外部 HTTPS をフェッチするため、cimd-fetcher をモジュールモック
const cimdFetchMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/cimd/cimd-fetcher.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/cimd/cimd-fetcher.js')>(
    '../../services/cimd/cimd-fetcher.js'
  );
  return {
    ...actual,
    fetchCimdMetadata: cimdFetchMock,
  };
});

// 認証ミドルウェアモック (oauth.integration.test.ts と同じパターン)
let mockAuthUser: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  createdAt: Date;
} | null = null;

vi.mock('@agentest/auth', () => ({
  requireAuth: () => (req: any, _res: any, next: any) => {
    if (!mockAuthUser) return next(new AuthenticationError('認証が必要です'));
    req.user = mockAuthUser;
    next();
  },
  optionalAuth: () => (req: any, _res: any, next: any) => {
    if (mockAuthUser) req.user = mockAuthUser;
    next();
  },
  authenticate:
    (options: { optional?: boolean } = {}) =>
    (req: any, _res: any, next: any) => {
      if (mockAuthUser) {
        req.user = mockAuthUser;
      } else if (!options.optional) {
        return next(new AuthenticationError('認証が必要です'));
      }
      next();
    },
  requireOrgRole: () => (_req: any, _res: any, next: any) => next(),
  requireProjectRole: () => (_req: any, _res: any, next: any) => next(),
  configurePassport: vi.fn(),
  passport: { initialize: vi.fn(), authenticate: vi.fn() },
  generateTokens: vi.fn(),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  decodeToken: vi.fn(),
  getTokenExpiry: vi.fn(),
  createAuthConfig: vi.fn(),
  defaultAuthConfig: {},
}));

import { createApp } from '../../app.js';

const CIMD_URL = 'https://example.com/.well-known/oauth-client/abc';

describe('OAuth CIMD 結合テスト', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    mockAuthUser = null;

    testUser = await createTestUser({
      email: 'oauth-cimd-test@example.com',
      name: 'OAuth CIMD Test User',
    });
  });

  describe('CIMD authorize', () => {
    it('CIMD URL を client_id にして authorize → upsert された OAuthClient を経て同意画面へ', async () => {
      cimdFetchMock.mockResolvedValue({
        status: 200,
        metadata: {
          client_id: CIMD_URL,
          client_name: 'Example MCP CIMD',
          redirect_uris: ['https://example.com/callback'],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
        },
        etag: '"v1"',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        fetchedAt: new Date(),
      });

      mockAuthUser = {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      };

      const response = await request(app).get('/oauth/authorize').query({
        response_type: 'code',
        client_id: CIMD_URL,
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
        resource: 'http://localhost:3002',
        state: 'random-state',
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/oauth/consent');
      expect(cimdFetchMock).toHaveBeenCalledWith(CIMD_URL, expect.any(Object));

      // DB に upsert されている
      const stored = await prisma.oAuthClient.findUnique({ where: { clientId: CIMD_URL } });
      expect(stored).not.toBeNull();
      expect(stored?.isCimd).toBe(true);
      expect(stored?.metadataUrl).toBe(CIMD_URL);
      expect(stored?.redirectUris).toEqual(['https://example.com/callback']);
      expect(stored?.metadataEtag).toBe('"v1"');
    });

    it('CIMD クライアントで redirect_uri がメタデータと不一致なら invalid_redirect_uri', async () => {
      cimdFetchMock.mockResolvedValue({
        status: 200,
        metadata: {
          client_id: CIMD_URL,
          client_name: 'Example MCP CIMD',
          redirect_uris: ['https://example.com/callback'],
          token_endpoint_auth_method: 'none',
        },
        etag: '"v1"',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        fetchedAt: new Date(),
      });

      mockAuthUser = {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      };

      const response = await request(app).get('/oauth/authorize').query({
        response_type: 'code',
        client_id: CIMD_URL,
        redirect_uri: 'https://attacker.example.com/callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
        resource: 'http://localhost:3002',
        state: 'random-state',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_redirect_uri');
    });

    it('CIMD メタデータの client_id がフェッチ URL と一致しない場合は invalid_client', async () => {
      cimdFetchMock.mockResolvedValue({
        status: 200,
        metadata: {
          client_id: 'https://attacker.example.com/client',
          redirect_uris: ['https://example.com/callback'],
          token_endpoint_auth_method: 'none',
        },
        etag: '"v1"',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        fetchedAt: new Date(),
      });

      mockAuthUser = {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      };

      const response = await request(app).get('/oauth/authorize').query({
        response_type: 'code',
        client_id: CIMD_URL,
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
        resource: 'http://localhost:3002',
        state: 'random-state',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('invalid_client');
    });
  });
});
