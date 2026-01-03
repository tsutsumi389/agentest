import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthService, OAuthError } from '../../services/oauth.service.js';
import type { IOAuthRepository } from '../../repositories/oauth.repository.js';
import { computeCodeChallenge } from '../../utils/pkce.js';

// リポジトリのモック
const createMockRepository = (): IOAuthRepository => ({
  createClient: vi.fn(),
  findClientByClientId: vi.fn(),
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
});

describe('OAuthService', () => {
  let service: OAuthService;
  let mockRepository: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository = createMockRepository();
    service = new OAuthService(mockRepository);
  });

  describe('getAuthorizationServerMetadata', () => {
    it('Authorization Server Metadataを返す', () => {
      const metadata = service.getAuthorizationServerMetadata();

      expect(metadata).toHaveProperty('issuer');
      expect(metadata).toHaveProperty('authorization_endpoint');
      expect(metadata).toHaveProperty('token_endpoint');
      expect(metadata).toHaveProperty('registration_endpoint');
      expect(metadata).toHaveProperty('revocation_endpoint');
      expect(metadata).toHaveProperty('introspection_endpoint');
      expect(metadata.response_types_supported).toEqual(['code']);
      expect(metadata.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
      expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
      expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none']);
    });
  });

  describe('registerClient', () => {
    it('正常にクライアントを登録できる', async () => {
      const input = {
        client_name: 'Test Client',
        redirect_uris: ['http://localhost:8080/callback'],
        grant_types: ['authorization_code'] as ('authorization_code' | 'refresh_token')[],
        response_types: ['code'] as 'code'[],
        token_endpoint_auth_method: 'none' as const,
        scope: 'mcp:read mcp:write',
      };

      const mockClient = {
        id: 'db-id',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        clientName: 'Test Client',
        redirectUris: ['http://localhost:8080/callback'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'none',
        scopes: ['mcp:read', 'mcp:write'],
        isActive: true,
        clientIdIssuedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockRepository.createClient as any).mockResolvedValue(mockClient);

      const result = await service.registerClient(input);

      expect(result.client_id).toBe(mockClient.clientId);
      expect(result.client_name).toBe(mockClient.clientName);
      expect(result.redirect_uris).toEqual(mockClient.redirectUris);
      expect(result.grant_types).toEqual(mockClient.grantTypes);
      expect(result.scope).toBe('mcp:read mcp:write');
    });

    it('invalid_redirect_uriエラーを返す（外部ドメイン）', async () => {
      const input = {
        client_name: 'Test Client',
        redirect_uris: ['https://evil.com/callback'],
        grant_types: ['authorization_code'] as ('authorization_code' | 'refresh_token')[],
        response_types: ['code'] as 'code'[],
        token_endpoint_auth_method: 'none' as const,
      };

      await expect(service.registerClient(input)).rejects.toThrow(OAuthError);
      await expect(service.registerClient(input)).rejects.toMatchObject({
        error: 'invalid_redirect_uri',
        statusCode: 400,
      });
    });

    it('複数のredirect_urisで1つでも無効なら拒否', async () => {
      const input = {
        client_name: 'Test Client',
        redirect_uris: ['http://localhost:8080/callback', 'https://evil.com/callback'],
        grant_types: ['authorization_code'] as ('authorization_code' | 'refresh_token')[],
        response_types: ['code'] as 'code'[],
        token_endpoint_auth_method: 'none' as const,
      };

      await expect(service.registerClient(input)).rejects.toThrow(OAuthError);
    });
  });

  describe('validateAuthorizeRequest', () => {
    it('正常なリクエストを検証できる', async () => {
      const input = {
        response_type: 'code' as const,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        redirect_uri: 'http://localhost:8080/callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256' as const,
        resource: 'http://localhost:3002',
        state: 'random-state',
        scope: 'mcp:read',
      };

      const mockClient = {
        id: 'db-id',
        clientId: input.client_id,
        clientName: 'Test Client',
        redirectUris: ['http://localhost:8080/callback'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'none',
        scopes: ['mcp:read'],
        isActive: true,
        clientIdIssuedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockRepository.findClientByClientId as any).mockResolvedValue(mockClient);

      const result = await service.validateAuthorizeRequest(input);

      expect(result.client).toEqual(mockClient);
      expect(result.scopes).toEqual(['mcp:read']);
      expect(result.redirectUri).toBe(input.redirect_uri);
    });

    it('クライアントが見つからない場合はinvalid_clientエラー', async () => {
      const input = {
        response_type: 'code' as const,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        redirect_uri: 'http://localhost:8080/callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256' as const,
        resource: 'http://localhost:3002',
        state: 'random-state',
      };

      (mockRepository.findClientByClientId as any).mockResolvedValue(null);

      await expect(service.validateAuthorizeRequest(input)).rejects.toMatchObject({
        error: 'invalid_client',
        statusCode: 401,
      });
    });

    it('redirect_uriが登録済みURIと一致しない場合はエラー', async () => {
      const input = {
        response_type: 'code' as const,
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        redirect_uri: 'http://localhost:9999/different',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256' as const,
        resource: 'http://localhost:3002',
        state: 'random-state',
      };

      const mockClient = {
        id: 'db-id',
        clientId: input.client_id,
        clientName: 'Test Client',
        redirectUris: ['http://localhost:8080/callback'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'none',
        scopes: [],
        isActive: true,
        clientIdIssuedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockRepository.findClientByClientId as any).mockResolvedValue(mockClient);

      await expect(service.validateAuthorizeRequest(input)).rejects.toMatchObject({
        error: 'invalid_redirect_uri',
        statusCode: 400,
      });
    });
  });

  describe('issueAuthorizationCode', () => {
    it('認可コードを発行してDBに保存する', async () => {
      const params = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        redirectUri: 'http://localhost:8080/callback',
        scopes: ['mcp:read'],
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
        resource: 'http://localhost:3002',
      };

      (mockRepository.createAuthorizationCode as any).mockResolvedValue({
        code: 'generated-code',
      });

      const code = await service.issueAuthorizationCode(params);

      expect(code).toBeTruthy();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThanOrEqual(43);

      expect(mockRepository.createAuthorizationCode).toHaveBeenCalledWith({
        code: expect.any(String),
        clientId: params.clientId,
        userId: params.userId,
        redirectUri: params.redirectUri,
        scopes: params.scopes,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: params.codeChallengeMethod,
        resource: params.resource,
        expiresAt: expect.any(Date),
      });
    });
  });

  describe('exchangeCodeForToken', () => {
    const validCodeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const validCodeChallenge = computeCodeChallenge(validCodeVerifier);

    it('正常にトークンを発行できる（リフレッシュトークン含む）', async () => {
      const input = {
        grant_type: 'authorization_code' as const,
        code: 'auth-code-123',
        redirect_uri: 'http://localhost:8080/callback',
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        code_verifier: validCodeVerifier,
      };

      const mockAuthCode = {
        id: 'auth-code-db-id',
        code: 'auth-code-123',
        clientId: input.client_id,
        userId: 'user-123',
        redirectUri: input.redirect_uri,
        scopes: ['mcp:read'],
        codeChallenge: validCodeChallenge,
        codeChallengeMethod: 'S256',
        resource: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 600000), // 未来
        usedAt: null,
      };

      const mockRefreshToken = {
        id: 'refresh-token-db-id',
      };

      (mockRepository.findAuthorizationCodeByCode as any).mockResolvedValue(mockAuthCode);
      (mockRepository.createRefreshToken as any).mockResolvedValue(mockRefreshToken);
      (mockRepository.createAccessToken as any).mockResolvedValue({});

      const result = await service.exchangeCodeForToken(input);

      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toBeTruthy();
      expect(result.token_type).toBe('Bearer');
      expect(result.expires_in).toBe(3600);
      expect(result.scope).toBe('mcp:read');

      expect(mockRepository.markAuthorizationCodeAsUsed).toHaveBeenCalledWith('auth-code-123');
      expect(mockRepository.createRefreshToken).toHaveBeenCalled();
      expect(mockRepository.createAccessToken).toHaveBeenCalled();
    });

    it('無効なcodeでinvalid_grantエラー', async () => {
      const input = {
        grant_type: 'authorization_code' as const,
        code: 'invalid-code',
        redirect_uri: 'http://localhost:8080/callback',
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        code_verifier: validCodeVerifier,
      };

      (mockRepository.findAuthorizationCodeByCode as any).mockResolvedValue(null);

      await expect(service.exchangeCodeForToken(input)).rejects.toMatchObject({
        error: 'invalid_grant',
        errorDescription: 'Authorization code not found',
      });
    });

    it('期限切れのcodeでinvalid_grantエラー', async () => {
      const input = {
        grant_type: 'authorization_code' as const,
        code: 'expired-code',
        redirect_uri: 'http://localhost:8080/callback',
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        code_verifier: validCodeVerifier,
      };

      const mockAuthCode = {
        id: 'auth-code-db-id',
        code: 'expired-code',
        clientId: input.client_id,
        userId: 'user-123',
        redirectUri: input.redirect_uri,
        scopes: ['mcp:read'],
        codeChallenge: validCodeChallenge,
        codeChallengeMethod: 'S256',
        resource: 'http://localhost:3002',
        expiresAt: new Date(Date.now() - 1000), // 過去
        usedAt: null,
      };

      (mockRepository.findAuthorizationCodeByCode as any).mockResolvedValue(mockAuthCode);

      await expect(service.exchangeCodeForToken(input)).rejects.toMatchObject({
        error: 'invalid_grant',
        errorDescription: 'Authorization code expired',
      });
    });

    it('使用済みのcodeでinvalid_grantエラー（トークン無効化付き）', async () => {
      const input = {
        grant_type: 'authorization_code' as const,
        code: 'used-code',
        redirect_uri: 'http://localhost:8080/callback',
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        code_verifier: validCodeVerifier,
      };

      const mockAuthCode = {
        id: 'auth-code-db-id',
        code: 'used-code',
        clientId: input.client_id,
        userId: 'user-123',
        redirectUri: input.redirect_uri,
        scopes: ['mcp:read'],
        codeChallenge: validCodeChallenge,
        codeChallengeMethod: 'S256',
        resource: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 600000),
        usedAt: new Date(), // 使用済み
      };

      (mockRepository.findAuthorizationCodeByCode as any).mockResolvedValue(mockAuthCode);

      await expect(service.exchangeCodeForToken(input)).rejects.toMatchObject({
        error: 'invalid_grant',
        errorDescription: 'Authorization code already used',
      });

      // セキュリティ対策：全アクセストークン無効化が呼ばれることを確認
      expect(mockRepository.revokeAllAccessTokensByUserId).toHaveBeenCalledWith(
        mockAuthCode.userId,
        mockAuthCode.clientId
      );

      // セキュリティ対策：全リフレッシュトークン無効化が呼ばれることを確認
      expect(mockRepository.revokeAllRefreshTokensByUserId).toHaveBeenCalledWith(
        mockAuthCode.userId,
        mockAuthCode.clientId
      );
    });

    it('クライアントID不一致でinvalid_grantエラー', async () => {
      const input = {
        grant_type: 'authorization_code' as const,
        code: 'auth-code-123',
        redirect_uri: 'http://localhost:8080/callback',
        client_id: 'different-client-id-00000000-0000-0000',
        code_verifier: validCodeVerifier,
      };

      const mockAuthCode = {
        id: 'auth-code-db-id',
        code: 'auth-code-123',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        redirectUri: input.redirect_uri,
        scopes: ['mcp:read'],
        codeChallenge: validCodeChallenge,
        codeChallengeMethod: 'S256',
        resource: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
      };

      (mockRepository.findAuthorizationCodeByCode as any).mockResolvedValue(mockAuthCode);

      await expect(service.exchangeCodeForToken(input)).rejects.toMatchObject({
        error: 'invalid_grant',
        errorDescription: 'Client ID mismatch',
      });
    });

    it('redirect_uri不一致でinvalid_grantエラー', async () => {
      const input = {
        grant_type: 'authorization_code' as const,
        code: 'auth-code-123',
        redirect_uri: 'http://localhost:9999/different',
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        code_verifier: validCodeVerifier,
      };

      const mockAuthCode = {
        id: 'auth-code-db-id',
        code: 'auth-code-123',
        clientId: input.client_id,
        userId: 'user-123',
        redirectUri: 'http://localhost:8080/callback',
        scopes: ['mcp:read'],
        codeChallenge: validCodeChallenge,
        codeChallengeMethod: 'S256',
        resource: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
      };

      (mockRepository.findAuthorizationCodeByCode as any).mockResolvedValue(mockAuthCode);

      await expect(service.exchangeCodeForToken(input)).rejects.toMatchObject({
        error: 'invalid_grant',
        errorDescription: 'redirect_uri mismatch',
      });
    });

    it('PKCE検証失敗でinvalid_grantエラー', async () => {
      const input = {
        grant_type: 'authorization_code' as const,
        code: 'auth-code-123',
        redirect_uri: 'http://localhost:8080/callback',
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        code_verifier: 'wrong-verifier-that-does-not-match-challenge',
      };

      const mockAuthCode = {
        id: 'auth-code-db-id',
        code: 'auth-code-123',
        clientId: input.client_id,
        userId: 'user-123',
        redirectUri: input.redirect_uri,
        scopes: ['mcp:read'],
        codeChallenge: validCodeChallenge,
        codeChallengeMethod: 'S256',
        resource: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
      };

      (mockRepository.findAuthorizationCodeByCode as any).mockResolvedValue(mockAuthCode);

      await expect(service.exchangeCodeForToken(input)).rejects.toMatchObject({
        error: 'invalid_grant',
        errorDescription: 'code_verifier verification failed',
      });
    });

    it('resource不一致でinvalid_targetエラー', async () => {
      const input = {
        grant_type: 'authorization_code' as const,
        code: 'auth-code-123',
        redirect_uri: 'http://localhost:8080/callback',
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        code_verifier: validCodeVerifier,
        resource: 'http://different-resource:3002',
      };

      const mockAuthCode = {
        id: 'auth-code-db-id',
        code: 'auth-code-123',
        clientId: input.client_id,
        userId: 'user-123',
        redirectUri: input.redirect_uri,
        scopes: ['mcp:read'],
        codeChallenge: validCodeChallenge,
        codeChallengeMethod: 'S256',
        resource: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
      };

      (mockRepository.findAuthorizationCodeByCode as any).mockResolvedValue(mockAuthCode);

      await expect(service.exchangeCodeForToken(input)).rejects.toMatchObject({
        error: 'invalid_target',
        errorDescription: 'resource mismatch',
      });
    });
  });

  describe('introspectToken', () => {
    it('有効なトークンでactive: trueを返す', async () => {
      const token = 'valid-access-token';

      const mockAccessToken = {
        id: 'token-db-id',
        tokenHash: 'hashed-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        scopes: ['mcp:read', 'mcp:write'],
        audience: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        createdAt: new Date(Date.now() - 60000),
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(mockAccessToken);

      const result = await service.introspectToken(token);

      expect(result.active).toBe(true);
      expect(result.client_id).toBe(mockAccessToken.clientId);
      expect(result.sub).toBe(mockAccessToken.userId);
      expect(result.scope).toBe('mcp:read mcp:write');
      expect(result.aud).toBe(mockAccessToken.audience);
      expect(result.exp).toBeDefined();
      expect(result.iat).toBeDefined();
    });

    it('トークンが見つからない場合はactive: false', async () => {
      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(null);

      const result = await service.introspectToken('non-existent-token');

      expect(result).toEqual({ active: false });
    });

    it('失効済みトークンでactive: false', async () => {
      const mockAccessToken = {
        id: 'token-db-id',
        tokenHash: 'hashed-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        scopes: ['mcp:read'],
        audience: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: new Date(), // 失効済み
        createdAt: new Date(Date.now() - 60000),
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(mockAccessToken);

      const result = await service.introspectToken('revoked-token');

      expect(result).toEqual({ active: false });
    });

    it('期限切れトークンでactive: false', async () => {
      const mockAccessToken = {
        id: 'token-db-id',
        tokenHash: 'hashed-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        scopes: ['mcp:read'],
        audience: 'http://localhost:3002',
        expiresAt: new Date(Date.now() - 1000), // 期限切れ
        revokedAt: null,
        createdAt: new Date(Date.now() - 3700000),
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(mockAccessToken);

      const result = await service.introspectToken('expired-token');

      expect(result).toEqual({ active: false });
    });
  });

  describe('revokeToken', () => {
    it('アクセストークンを失効させられる', async () => {
      const mockAccessToken = {
        id: 'token-db-id',
        tokenHash: 'hashed-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(mockAccessToken);

      await service.revokeToken('access-token');

      expect(mockRepository.revokeAccessToken).toHaveBeenCalled();
    });

    it('リフレッシュトークンを失効させられる', async () => {
      const mockRefreshToken = {
        id: 'refresh-token-db-id',
        tokenHash: 'hashed-refresh-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(null);
      (mockRepository.findRefreshTokenByHash as any).mockResolvedValue(mockRefreshToken);

      await service.revokeToken('refresh-token');

      expect(mockRepository.revokeRefreshToken).toHaveBeenCalled();
    });

    it('トークンが見つからなくてもエラーにならない（RFC 7009準拠）', async () => {
      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(null);
      (mockRepository.findRefreshTokenByHash as any).mockResolvedValue(null);

      await expect(service.revokeToken('non-existent-token')).resolves.not.toThrow();
      expect(mockRepository.revokeAccessToken).not.toHaveBeenCalled();
      expect(mockRepository.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('アクセストークン：クライアントID不一致の場合は何もしない（RFC 7009準拠）', async () => {
      const mockAccessToken = {
        id: 'token-db-id',
        tokenHash: 'hashed-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(mockAccessToken);

      await service.revokeToken('access-token', 'different-client-id');

      expect(mockRepository.revokeAccessToken).not.toHaveBeenCalled();
    });

    it('リフレッシュトークン：クライアントID不一致の場合は何もしない（RFC 7009準拠）', async () => {
      const mockRefreshToken = {
        id: 'refresh-token-db-id',
        tokenHash: 'hashed-refresh-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(null);
      (mockRepository.findRefreshTokenByHash as any).mockResolvedValue(mockRefreshToken);

      await service.revokeToken('refresh-token', 'different-client-id');

      expect(mockRepository.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('validateAccessToken', () => {
    it('有効なトークンでユーザーID・スコープを返す', async () => {
      const mockAccessToken = {
        id: 'token-db-id',
        tokenHash: 'hashed-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        scopes: ['mcp:read', 'mcp:write'],
        audience: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        createdAt: new Date(Date.now() - 60000),
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(mockAccessToken);

      const result = await service.validateAccessToken('access-token', 'http://localhost:3002');

      expect(result).toEqual({
        userId: 'user-123',
        scopes: ['mcp:read', 'mcp:write'],
      });
    });

    it('無効なトークンでnullを返す', async () => {
      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(null);

      const result = await service.validateAccessToken('invalid-token');

      expect(result).toBeNull();
    });

    it('Audience不一致でnullを返す', async () => {
      const mockAccessToken = {
        id: 'token-db-id',
        tokenHash: 'hashed-token',
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-123',
        scopes: ['mcp:read'],
        audience: 'http://localhost:3002',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        createdAt: new Date(Date.now() - 60000),
      };

      (mockRepository.findAccessTokenByHash as any).mockResolvedValue(mockAccessToken);

      const result = await service.validateAccessToken('access-token', 'http://different-audience:3002');

      expect(result).toBeNull();
    });
  });
});
