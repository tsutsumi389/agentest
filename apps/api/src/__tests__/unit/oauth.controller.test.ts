import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// vi.hoisted でホイスティング問題を回避
const mockOAuthService = vi.hoisted(() => ({
  getAuthorizationServerMetadata: vi.fn(),
  registerClient: vi.fn(),
  validateAuthorizeRequest: vi.fn(),
  issueAuthorizationCode: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  introspectToken: vi.fn(),
  revokeToken: vi.fn(),
}));

// OAuthError クラスのモック（vi.hoistedで巻き上げ対応）
const MockOAuthError = vi.hoisted(() => {
  class _MockOAuthError extends Error {
    constructor(
      public error: string,
      public errorDescription: string,
      public statusCode: number = 400,
    ) {
      super(errorDescription);
      this.name = 'OAuthError';
    }
  }
  return _MockOAuthError;
});

vi.mock('../../services/oauth.service.js', () => ({
  OAuthService: vi.fn().mockImplementation(() => mockOAuthService),
  OAuthError: MockOAuthError,
}));

// env モック
vi.mock('../../config/env.js', () => ({
  env: {
    FRONTEND_URL: 'https://app.example.com',
    API_BASE_URL: 'https://api.example.com',
  },
}));

// コントローラのインポートはモック後に行う
import { OAuthController } from '../../controllers/oauth.controller.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_CLIENT_ID = '22222222-2222-2222-2222-222222222222';

// Express モックヘルパー
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID } as any,
  params: {},
  body: {},
  query: {},
  originalUrl: '/oauth/authorize?test=1',
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
};

describe('OAuthController', () => {
  let controller: OAuthController;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new OAuthController();
    next = vi.fn();
  });

  // ============================================
  // getMetadata
  // ============================================
  describe('getMetadata', () => {
    it('認可サーバーメタデータをJSON形式で返す', () => {
      const metadata = {
        issuer: 'https://api.example.com',
        authorization_endpoint: 'https://api.example.com/oauth/authorize',
        token_endpoint: 'https://api.example.com/oauth/token',
      };
      mockOAuthService.getAuthorizationServerMetadata.mockReturnValue(metadata);

      const req = mockRequest();
      const res = mockResponse();

      controller.getMetadata(req as Request, res as Response);

      expect(mockOAuthService.getAuthorizationServerMetadata).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(metadata);
    });
  });

  // ============================================
  // register
  // ============================================
  describe('register', () => {
    // 有効な登録リクエストボディ
    const validRegistrationBody = {
      client_name: 'Test App',
      redirect_uris: ['http://localhost:8080/callback'],
    };

    it('正常にクライアント登録して201を返す', async () => {
      const registrationResult = {
        client_id: TEST_CLIENT_ID,
        client_name: 'Test App',
        redirect_uris: ['http://localhost:8080/callback'],
      };
      mockOAuthService.registerClient.mockResolvedValue(registrationResult);

      const req = mockRequest({ body: validRegistrationBody });
      const res = mockResponse();

      await controller.register(req as Request, res as Response, next);

      expect(mockOAuthService.registerClient).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(registrationResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('バリデーションエラー時に400 invalid_client_metadataを返す', async () => {
      // client_nameが空のボディを送信してZodErrorを発生させる
      const invalidBody = {
        client_name: '',
        redirect_uris: ['http://localhost:8080/callback'],
      };

      const req = mockRequest({ body: invalidBody });
      const res = mockResponse();

      await controller.register(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_client_metadata',
          error_description: expect.any(String),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('OAuthError時にカスタムステータスコードとエラー情報を返す', async () => {
      mockOAuthService.registerClient.mockRejectedValue(
        new MockOAuthError('invalid_client', 'Client already exists', 409),
      );

      const req = mockRequest({ body: validRegistrationBody });
      const res = mockResponse();

      await controller.register(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_client',
        error_description: 'Client already exists',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('予期しないエラーはnextに渡す', async () => {
      const unexpectedError = new Error('Database connection failed');
      mockOAuthService.registerClient.mockRejectedValue(unexpectedError);

      const req = mockRequest({ body: validRegistrationBody });
      const res = mockResponse();

      await controller.register(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(unexpectedError);
    });
  });

  // ============================================
  // authorize
  // ============================================
  describe('authorize', () => {
    // 有効な認可リクエストクエリパラメータ
    const validAuthorizeQuery = {
      response_type: 'code',
      client_id: TEST_CLIENT_ID,
      redirect_uri: 'http://localhost:8080/callback',
      code_challenge: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-0123456789',
      code_challenge_method: 'S256',
      resource: 'https://api.example.com/',
      state: 'random-state-value',
    };

    const validatedResult = {
      client: { clientName: 'Test App', clientId: TEST_CLIENT_ID },
      scopes: ['mcp:read', 'mcp:write'],
      redirectUri: 'http://localhost:8080/callback',
    };

    it('未認証ユーザーの場合ログインページにリダイレクトする', async () => {
      mockOAuthService.validateAuthorizeRequest.mockResolvedValue(validatedResult);

      const req = mockRequest({ user: undefined, query: validAuthorizeQuery });
      const res = mockResponse();

      await controller.authorize(req as Request, res as Response, next);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://app.example.com/login'),
      );
      // リダイレクトURLにreturnパラメータが含まれることを確認
      const redirectUrl = (res.redirect as any).mock.calls[0][0];
      const url = new URL(redirectUrl);
      expect(url.searchParams.get('redirect')).toContain('/oauth/authorize');
    });

    it('認証済みユーザーの場合同意画面にリダイレクトする', async () => {
      mockOAuthService.validateAuthorizeRequest.mockResolvedValue(validatedResult);

      const req = mockRequest({ query: validAuthorizeQuery });
      const res = mockResponse();

      await controller.authorize(req as Request, res as Response, next);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://app.example.com/oauth/consent'),
      );
      // 同意画面URLに必要なパラメータが含まれることを確認
      const redirectUrl = (res.redirect as any).mock.calls[0][0];
      const url = new URL(redirectUrl);
      expect(url.searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(url.searchParams.get('client_name')).toBe('Test App');
      expect(url.searchParams.get('scope')).toBe('mcp:read mcp:write');
      expect(url.searchParams.get('state')).toBe('random-state-value');
    });

    it('バリデーションエラー時に400 invalid_requestを返す', async () => {
      // response_typeが不正なクエリを送信
      const invalidQuery = { response_type: 'invalid' };

      const req = mockRequest({ query: invalidQuery });
      const res = mockResponse();

      await controller.authorize(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_request',
          error_description: expect.any(String),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('OAuthError時にステータスコードとエラー情報を返す', async () => {
      mockOAuthService.validateAuthorizeRequest.mockRejectedValue(
        new MockOAuthError('invalid_client', 'Unknown client_id', 400),
      );

      const req = mockRequest({ query: validAuthorizeQuery });
      const res = mockResponse();

      await controller.authorize(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_client',
        error_description: 'Unknown client_id',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // consent
  // ============================================
  describe('consent', () => {
    const consentBody = {
      client_id: TEST_CLIENT_ID,
      redirect_uri: 'http://localhost:8080/callback',
      scope: 'mcp:read mcp:write',
      state: 'random-state-value',
      code_challenge: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-0123456789',
      code_challenge_method: 'S256',
      resource: 'https://api.example.com/',
      approved: true,
    };

    it('未認証ユーザーの場合401を返す', async () => {
      const req = mockRequest({ user: undefined, body: consentBody });
      const res = mockResponse();

      await controller.consent(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'unauthorized',
        error_description: 'User not authenticated',
      });
    });

    it('拒否された場合access_deniedエラー付きのリダイレクトURLを返す', async () => {
      const deniedBody = { ...consentBody, approved: false };
      const req = mockRequest({ body: deniedBody });
      const res = mockResponse();

      await controller.consent(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          redirect_url: expect.any(String),
        }),
      );
      // リダイレクトURLにaccess_deniedエラーが含まれることを確認
      const result = (res.json as any).mock.calls[0][0];
      const redirectUrl = new URL(result.redirect_url);
      expect(redirectUrl.searchParams.get('error')).toBe('access_denied');
      expect(redirectUrl.searchParams.get('error_description')).toBe('User denied access');
      expect(redirectUrl.searchParams.get('state')).toBe('random-state-value');
    });

    it('承認された場合認可コードを発行しリダイレクトURLを返す', async () => {
      const authorizationCode = 'test-authorization-code';
      mockOAuthService.issueAuthorizationCode.mockResolvedValue(authorizationCode);

      const req = mockRequest({ body: consentBody });
      const res = mockResponse();

      await controller.consent(req as Request, res as Response, next);

      // サービスへの正しい引数を確認
      expect(mockOAuthService.issueAuthorizationCode).toHaveBeenCalledWith({
        clientId: TEST_CLIENT_ID,
        userId: TEST_USER_ID,
        redirectUri: 'http://localhost:8080/callback',
        scopes: ['mcp:read', 'mcp:write'],
        codeChallenge: consentBody.code_challenge,
        codeChallengeMethod: 'S256',
        resource: 'https://api.example.com/',
      });

      // レスポンスのリダイレクトURLに認可コードとstateが含まれることを確認
      const result = (res.json as any).mock.calls[0][0];
      const redirectUrl = new URL(result.redirect_url);
      expect(redirectUrl.searchParams.get('code')).toBe(authorizationCode);
      expect(redirectUrl.searchParams.get('state')).toBe('random-state-value');
    });

    it('OAuthError発生時にredirect_uriがあればリダイレクトURLを返す', async () => {
      mockOAuthService.issueAuthorizationCode.mockRejectedValue(
        new MockOAuthError('server_error', 'Internal error', 500),
      );

      const req = mockRequest({ body: consentBody });
      const res = mockResponse();

      await controller.consent(req as Request, res as Response, next);

      // redirect_uriがbodyにあるのでJSONでリダイレクトURLを返す
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          redirect_url: expect.any(String),
        }),
      );
      const result = (res.json as any).mock.calls[0][0];
      const redirectUrl = new URL(result.redirect_url);
      expect(redirectUrl.searchParams.get('error')).toBe('server_error');
      expect(redirectUrl.searchParams.get('error_description')).toBe('Internal error');
      expect(redirectUrl.searchParams.get('state')).toBe('random-state-value');
    });

    it('OAuthError発生時にredirect_uriがなければステータスコードとJSONを返す', async () => {
      mockOAuthService.issueAuthorizationCode.mockRejectedValue(
        new MockOAuthError('invalid_client', 'Client not found', 400),
      );

      // redirect_uriを含まないボディ
      const bodyWithoutRedirect = { ...consentBody, redirect_uri: undefined };
      const req = mockRequest({ body: bodyWithoutRedirect });
      const res = mockResponse();

      await controller.consent(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_client',
        error_description: 'Client not found',
      });
    });
  });

  // ============================================
  // token
  // ============================================
  describe('token', () => {
    const validTokenBody = {
      grant_type: 'authorization_code' as const,
      code: 'valid-authorization-code',
      redirect_uri: 'http://localhost:8080/callback',
      client_id: TEST_CLIENT_ID,
      code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-0123456789',
    };

    it('正常にトークンを交換しCache-Controlヘッダーを設定する', async () => {
      const tokenResult = {
        access_token: 'access-token-value',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token-value',
        scope: 'mcp:read mcp:write',
      };
      mockOAuthService.exchangeCodeForToken.mockResolvedValue(tokenResult);

      const req = mockRequest({ body: validTokenBody });
      const res = mockResponse();

      await controller.token(req as Request, res as Response, next);

      expect(mockOAuthService.exchangeCodeForToken).toHaveBeenCalled();
      // RFC 6749に準拠したキャッシュ制御ヘッダーを確認
      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(res.set).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(res.json).toHaveBeenCalledWith(tokenResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('バリデーションエラー時に400 invalid_requestを返す', async () => {
      // grant_typeが不正なボディ
      const invalidBody = { grant_type: 'invalid_grant' };

      const req = mockRequest({ body: invalidBody });
      const res = mockResponse();

      await controller.token(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_request',
          error_description: expect.any(String),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('OAuthError時にステータスコードとエラー情報を返す', async () => {
      mockOAuthService.exchangeCodeForToken.mockRejectedValue(
        new MockOAuthError('invalid_grant', 'Authorization code expired', 400),
      );

      const req = mockRequest({ body: validTokenBody });
      const res = mockResponse();

      await controller.token(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // introspect
  // ============================================
  describe('introspect', () => {
    it('正常にトークンをイントロスペクトしてJSON結果を返す', async () => {
      const introspectionResult = {
        active: true,
        client_id: TEST_CLIENT_ID,
        scope: 'mcp:read',
        token_type: 'Bearer',
      };
      mockOAuthService.introspectToken.mockResolvedValue(introspectionResult);

      const req = mockRequest({ body: { token: 'valid-access-token' } });
      const res = mockResponse();

      await controller.introspect(req as Request, res as Response, next);

      expect(mockOAuthService.introspectToken).toHaveBeenCalledWith('valid-access-token');
      expect(res.json).toHaveBeenCalledWith(introspectionResult);
      expect(next).not.toHaveBeenCalled();
    });

    it('バリデーションエラー時に400 invalid_requestを返す', async () => {
      // tokenフィールドが空のボディ
      const req = mockRequest({ body: { token: '' } });
      const res = mockResponse();

      await controller.introspect(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_request',
          error_description: expect.any(String),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // revoke
  // ============================================
  describe('revoke', () => {
    it('正常にトークンを失効して200を返す', async () => {
      mockOAuthService.revokeToken.mockResolvedValue(undefined);

      const req = mockRequest({
        body: { token: 'token-to-revoke', client_id: TEST_CLIENT_ID },
      });
      const res = mockResponse();

      await controller.revoke(req as Request, res as Response, next);

      expect(mockOAuthService.revokeToken).toHaveBeenCalledWith('token-to-revoke', TEST_CLIENT_ID);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('バリデーションエラー時に400 invalid_requestを返す', async () => {
      // tokenフィールドが空のボディ
      const req = mockRequest({ body: { token: '' } });
      const res = mockResponse();

      await controller.revoke(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'invalid_request',
          error_description: expect.any(String),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
