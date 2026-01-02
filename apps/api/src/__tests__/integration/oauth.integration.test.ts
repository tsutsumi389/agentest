import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestOAuthClient,
  createTestOAuthAuthorizationCode,
  createTestOAuthAccessToken,
  cleanupTestData,
} from './test-helpers.js';
import { createApp } from '../../app.js';
import { computeCodeChallenge, hashToken } from '../../utils/pkce.js';
import { AuthenticationError } from '@agentest/shared';

// グローバルな認証状態（モック用）
let mockAuthUser: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: string;
  createdAt: Date;
} | null = null;

// vi.hoistedを使用してモック関数を事前定義
vi.mock('@agentest/auth', () => ({
  requireAuth: () => (req: any, _res: any, next: any) => {
    if (!mockAuthUser) {
      return next(new AuthenticationError('認証が必要です'));
    }
    req.user = mockAuthUser;
    next();
  },
  optionalAuth: () => (req: any, _res: any, next: any) => {
    if (mockAuthUser) {
      req.user = mockAuthUser;
    }
    next();
  },
  // authenticate関数 - optional: trueの場合は認証失敗でもnextを呼ぶ
  authenticate: (options: { optional?: boolean } = {}) => (req: any, _res: any, next: any) => {
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

// テスト用認証設定関数
function setTestAuth(user: typeof mockAuthUser) {
  mockAuthUser = user;
}

function clearTestAuth() {
  mockAuthUser = null;
}

describe('OAuth API 結合テスト', () => {
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
    clearTestAuth();

    // テストユーザーを作成
    testUser = await createTestUser({
      email: 'oauth-test@example.com',
      name: 'OAuth Test User',
    });
  });

  describe('GET /.well-known/oauth-authorization-server', () => {
    it('Authorization Server Metadataを返す', async () => {
      const response = await request(app).get('/.well-known/oauth-authorization-server');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('token_endpoint');
      expect(response.body).toHaveProperty('registration_endpoint');
      expect(response.body.response_types_supported).toEqual(['code']);
      expect(response.body.grant_types_supported).toEqual(['authorization_code']);
      expect(response.body.code_challenge_methods_supported).toEqual(['S256']);
    });
  });

  describe('POST /oauth/register', () => {
    it('正常系: クライアントを登録できる (201 Created)', async () => {
      const response = await request(app)
        .post('/oauth/register')
        .send({
          client_name: 'Test MCP Client',
          redirect_uris: ['http://localhost:8080/callback'],
          scope: 'mcp:read mcp:write',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('client_id');
      expect(response.body.client_name).toBe('Test MCP Client');
      expect(response.body.redirect_uris).toEqual(['http://localhost:8080/callback']);
      expect(response.body.grant_types).toEqual(['authorization_code']);
      expect(response.body.response_types).toEqual(['code']);
      expect(response.body.token_endpoint_auth_method).toBe('none');

      // DBに保存されていることを確認
      const client = await prisma.oAuthClient.findUnique({
        where: { clientId: response.body.client_id },
      });
      expect(client).not.toBeNull();
      expect(client?.clientName).toBe('Test MCP Client');
    });

    it('異常系: invalid_redirect_uri (外部ドメイン)', async () => {
      const response = await request(app)
        .post('/oauth/register')
        .send({
          client_name: 'Malicious Client',
          redirect_uris: ['https://evil.com/callback'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_redirect_uri');
    });

    it('異常系: invalid_client_metadata (必須フィールド欠落)', async () => {
      const response = await request(app)
        .post('/oauth/register')
        .send({
          client_name: 'Test Client',
          // redirect_uris が欠落
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_client_metadata');
    });

    it('異常系: invalid_client_metadata (redirect_uriが不正なURL)', async () => {
      const response = await request(app)
        .post('/oauth/register')
        .send({
          client_name: 'Test Client',
          redirect_uris: ['not-a-valid-url'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_client_metadata');
    });
  });

  describe('GET /oauth/authorize', () => {
    let testClient: Awaited<ReturnType<typeof createTestOAuthClient>>;

    beforeEach(async () => {
      testClient = await createTestOAuthClient({
        clientName: 'Test Auth Client',
        redirectUris: ['http://localhost:8080/callback'],
      });
    });

    it('未認証ならログインページへリダイレクト', async () => {
      clearTestAuth();

      const response = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: 'http://localhost:8080/callback',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          resource: 'http://localhost:3002',
          state: 'random-state',
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/login');
    });

    it('認証済みなら同意画面へリダイレクト', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      });

      const response = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: 'http://localhost:8080/callback',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          resource: 'http://localhost:3002',
          state: 'random-state',
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/oauth/consent');
      expect(response.headers.location).toContain('client_id=' + testClient.clientId);
    });

    it('異常系: invalid_client (存在しないクライアント)', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      });

      const response = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: '00000000-0000-0000-0000-000000000000',
          redirect_uri: 'http://localhost:8080/callback',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          resource: 'http://localhost:3002',
          state: 'random-state',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('invalid_client');
    });

    it('異常系: redirect_uri不一致', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      });

      const response = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: testClient.clientId,
          redirect_uri: 'http://localhost:9999/different',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          resource: 'http://localhost:3002',
          state: 'random-state',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_redirect_uri');
    });
  });

  describe('POST /oauth/authorize/consent', () => {
    let testClient: Awaited<ReturnType<typeof createTestOAuthClient>>;

    beforeEach(async () => {
      testClient = await createTestOAuthClient({
        clientName: 'Test Consent Client',
        redirectUris: ['http://localhost:8080/callback'],
      });
    });

    it('正常系: 認可コードを発行してリダイレクト', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      });

      const response = await request(app)
        .post('/oauth/authorize/consent')
        .send({
          client_id: testClient.clientId,
          redirect_uri: 'http://localhost:8080/callback',
          scope: 'mcp:read',
          state: 'random-state',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          resource: 'http://localhost:3002',
          approved: true,
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('http://localhost:8080/callback');
      expect(response.headers.location).toContain('code=');
      expect(response.headers.location).toContain('state=random-state');

      // DBに認可コードが保存されていることを確認
      const url = new URL(response.headers.location);
      const code = url.searchParams.get('code');
      const authCode = await prisma.oAuthAuthorizationCode.findUnique({
        where: { code: code! },
      });
      expect(authCode).not.toBeNull();
      expect(authCode?.clientId).toBe(testClient.clientId);
      expect(authCode?.userId).toBe(testUser.id);
    });

    it('正常系: 拒否された場合はaccess_deniedエラー', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      });

      const response = await request(app)
        .post('/oauth/authorize/consent')
        .send({
          client_id: testClient.clientId,
          redirect_uri: 'http://localhost:8080/callback',
          scope: 'mcp:read',
          state: 'random-state',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          resource: 'http://localhost:3002',
          approved: false,
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('error=access_denied');
      expect(response.headers.location).toContain('state=random-state');
    });

    it('異常系: 未認証の場合は401エラー', async () => {
      clearTestAuth();

      const response = await request(app)
        .post('/oauth/authorize/consent')
        .send({
          client_id: testClient.clientId,
          redirect_uri: 'http://localhost:8080/callback',
          approved: true,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /oauth/token', () => {
    let testClient: Awaited<ReturnType<typeof createTestOAuthClient>>;
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const codeChallenge = computeCodeChallenge(codeVerifier);

    beforeEach(async () => {
      testClient = await createTestOAuthClient({
        clientName: 'Test Token Client',
        redirectUris: ['http://localhost:8080/callback'],
      });
    });

    it('正常系: トークンを発行できる', async () => {
      // 認可コードを作成
      const authCode = await createTestOAuthAuthorizationCode(
        testClient.clientId,
        testUser.id,
        {
          code: 'valid-auth-code',
          codeChallenge,
          codeChallengeMethod: 'S256',
          redirectUri: 'http://localhost:8080/callback',
          resource: 'http://localhost:3002',
          scopes: ['mcp:read'],
        }
      );

      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: authCode.code,
          redirect_uri: 'http://localhost:8080/callback',
          client_id: testClient.clientId,
          code_verifier: codeVerifier,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(3600);
      expect(response.body.scope).toBe('mcp:read');

      // Cache-Controlヘッダーが設定されていることを確認
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['pragma']).toBe('no-cache');

      // DBにアクセストークンが保存されていることを確認
      const tokenHash = hashToken(response.body.access_token);
      const accessToken = await prisma.oAuthAccessToken.findUnique({
        where: { tokenHash },
      });
      expect(accessToken).not.toBeNull();
      expect(accessToken?.userId).toBe(testUser.id);

      // 認可コードが使用済みにマークされていることを確認
      const usedAuthCode = await prisma.oAuthAuthorizationCode.findUnique({
        where: { code: authCode.code },
      });
      expect(usedAuthCode?.usedAt).not.toBeNull();
    });

    it('異常系: invalid_grant (無効なcode)', async () => {
      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: 'invalid-code',
          redirect_uri: 'http://localhost:8080/callback',
          client_id: testClient.clientId,
          code_verifier: codeVerifier,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_grant');
    });

    it('異常系: invalid_grant (期限切れcode)', async () => {
      const authCode = await createTestOAuthAuthorizationCode(
        testClient.clientId,
        testUser.id,
        {
          code: 'expired-auth-code',
          codeChallenge,
          codeChallengeMethod: 'S256',
          expiresAt: new Date(Date.now() - 1000), // 過去の日時
        }
      );

      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: authCode.code,
          redirect_uri: 'http://localhost:8080/callback',
          client_id: testClient.clientId,
          code_verifier: codeVerifier,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_grant');
      expect(response.body.error_description).toContain('expired');
    });

    it('異常系: PKCE検証失敗', async () => {
      const authCode = await createTestOAuthAuthorizationCode(
        testClient.clientId,
        testUser.id,
        {
          code: 'pkce-test-code',
          codeChallenge,
          codeChallengeMethod: 'S256',
        }
      );

      const response = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: authCode.code,
          redirect_uri: 'http://localhost:8080/callback',
          client_id: testClient.clientId,
          code_verifier: 'wrong-verifier-that-does-not-match-challenge',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_grant');
      expect(response.body.error_description).toContain('code_verifier');
    });
  });

  describe('POST /oauth/introspect', () => {
    let testClient: Awaited<ReturnType<typeof createTestOAuthClient>>;
    // 内部API認証用のシークレット（デフォルト値）
    const internalApiSecret = 'development-internal-api-secret-32ch';

    beforeEach(async () => {
      testClient = await createTestOAuthClient({
        clientName: 'Test Introspect Client',
      });
    });

    it('正常系: active: true (有効なトークン)', async () => {
      const accessToken = await createTestOAuthAccessToken(
        testClient.clientId,
        testUser.id,
        {
          tokenHash: hashToken('valid-token'),
          scopes: ['mcp:read', 'mcp:write'],
          audience: 'http://localhost:3002',
        }
      );

      const response = await request(app)
        .post('/oauth/introspect')
        .set('X-Internal-Api-Key', internalApiSecret)
        .send({ token: 'valid-token' });

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(true);
      expect(response.body.client_id).toBe(testClient.clientId);
      expect(response.body.sub).toBe(testUser.id);
      expect(response.body.scope).toBe('mcp:read mcp:write');
      expect(response.body.aud).toBe('http://localhost:3002');
    });

    it('正常系: active: false (期限切れトークン)', async () => {
      await createTestOAuthAccessToken(
        testClient.clientId,
        testUser.id,
        {
          tokenHash: hashToken('expired-token'),
          expiresAt: new Date(Date.now() - 1000), // 過去
        }
      );

      const response = await request(app)
        .post('/oauth/introspect')
        .set('X-Internal-Api-Key', internalApiSecret)
        .send({ token: 'expired-token' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ active: false });
    });

    it('正常系: active: false (失効済みトークン)', async () => {
      await createTestOAuthAccessToken(
        testClient.clientId,
        testUser.id,
        {
          tokenHash: hashToken('revoked-token'),
          revokedAt: new Date(), // 失効済み
        }
      );

      const response = await request(app)
        .post('/oauth/introspect')
        .set('X-Internal-Api-Key', internalApiSecret)
        .send({ token: 'revoked-token' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ active: false });
    });

    it('正常系: active: false (存在しないトークン)', async () => {
      const response = await request(app)
        .post('/oauth/introspect')
        .set('X-Internal-Api-Key', internalApiSecret)
        .send({ token: 'non-existent-token' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ active: false });
    });
  });

  describe('POST /oauth/revoke', () => {
    let testClient: Awaited<ReturnType<typeof createTestOAuthClient>>;

    beforeEach(async () => {
      testClient = await createTestOAuthClient({
        clientName: 'Test Revoke Client',
      });
    });

    it('正常系: トークンを失効させる', async () => {
      await createTestOAuthAccessToken(
        testClient.clientId,
        testUser.id,
        {
          tokenHash: hashToken('token-to-revoke'),
        }
      );

      const response = await request(app)
        .post('/oauth/revoke')
        .send({ token: 'token-to-revoke' });

      expect(response.status).toBe(200);

      // DBでトークンが失効されていることを確認
      const revokedToken = await prisma.oAuthAccessToken.findUnique({
        where: { tokenHash: hashToken('token-to-revoke') },
      });
      expect(revokedToken?.revokedAt).not.toBeNull();
    });

    it('正常系: 存在しないトークンでも200を返す (RFC 7009準拠)', async () => {
      const response = await request(app)
        .post('/oauth/revoke')
        .send({ token: 'non-existent-token' });

      expect(response.status).toBe(200);
    });
  });

  describe('完全なOAuth 2.1フロー', () => {
    // 内部API認証用のシークレット（デフォルト値）
    const internalApiSecret = 'development-internal-api-secret-32ch';

    it('動的クライアント登録 → 認可 → トークン発行 → イントロスペクション', async () => {
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const codeChallenge = computeCodeChallenge(codeVerifier);

      // 1. クライアント登録
      const registerResponse = await request(app)
        .post('/oauth/register')
        .send({
          client_name: 'Full Flow Test Client',
          redirect_uris: ['http://localhost:8080/callback'],
          scope: 'mcp:read mcp:write',
        });

      expect(registerResponse.status).toBe(201);
      const clientId = registerResponse.body.client_id;

      // 2. 認可（認証済み状態で同意）
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: testUser.avatarUrl,
        plan: 'FREE',
        createdAt: testUser.createdAt,
      });

      const consentResponse = await request(app)
        .post('/oauth/authorize/consent')
        .send({
          client_id: clientId,
          redirect_uri: 'http://localhost:8080/callback',
          scope: 'mcp:read mcp:write',
          state: 'test-state',
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          resource: 'http://localhost:3002',
          approved: true,
        });

      expect(consentResponse.status).toBe(302);
      const redirectUrl = new URL(consentResponse.headers.location);
      const authCode = redirectUrl.searchParams.get('code');
      expect(authCode).toBeTruthy();

      // 3. トークン発行
      const tokenResponse = await request(app)
        .post('/oauth/token')
        .send({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: 'http://localhost:8080/callback',
          client_id: clientId,
          code_verifier: codeVerifier,
        });

      expect(tokenResponse.status).toBe(200);
      expect(tokenResponse.body.access_token).toBeTruthy();
      const accessToken = tokenResponse.body.access_token;

      // 4. イントロスペクション（内部API認証必須）
      const introspectResponse = await request(app)
        .post('/oauth/introspect')
        .set('X-Internal-Api-Key', internalApiSecret)
        .send({ token: accessToken });

      expect(introspectResponse.status).toBe(200);
      expect(introspectResponse.body.active).toBe(true);
      expect(introspectResponse.body.client_id).toBe(clientId);
      expect(introspectResponse.body.sub).toBe(testUser.id);
      expect(introspectResponse.body.scope).toBe('mcp:read mcp:write');

      // 5. トークン失効
      const revokeResponse = await request(app)
        .post('/oauth/revoke')
        .send({ token: accessToken });

      expect(revokeResponse.status).toBe(200);

      // 6. 失効後のイントロスペクション
      const afterRevokeResponse = await request(app)
        .post('/oauth/introspect')
        .set('X-Internal-Api-Key', internalApiSecret)
        .send({ token: accessToken });

      expect(afterRevokeResponse.status).toBe(200);
      expect(afterRevokeResponse.body.active).toBe(false);
    });
  });
});
