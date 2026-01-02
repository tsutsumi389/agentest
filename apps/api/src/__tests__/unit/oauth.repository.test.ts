import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthRepository } from '../../repositories/oauth.repository.js';

// Prismaクライアントのモック
const mockPrisma = {
  oAuthClient: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  oAuthAuthorizationCode: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  oAuthAccessToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

describe('OAuthRepository', () => {
  let repository: OAuthRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new OAuthRepository(mockPrisma as any);
  });

  describe('クライアント操作', () => {
    describe('createClient', () => {
      it('新しいOAuthクライアントを作成できる', async () => {
        const input = {
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          clientName: 'Test Client',
          redirectUris: ['http://localhost:8080/callback'],
          grantTypes: ['authorization_code'],
          responseTypes: ['code'],
          tokenEndpointAuthMethod: 'none',
          scopes: ['mcp:read', 'mcp:write'],
          clientUri: 'https://example.com',
          logoUri: 'https://example.com/logo.png',
          softwareId: 'test-software',
          softwareVersion: '1.0.0',
        };

        const mockClient = {
          id: 'client-db-id',
          ...input,
          isActive: true,
          clientIdIssuedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.oAuthClient.create.mockResolvedValue(mockClient);

        const result = await repository.createClient(input);

        expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith({
          data: {
            clientId: input.clientId,
            clientName: input.clientName,
            redirectUris: input.redirectUris,
            grantTypes: input.grantTypes,
            responseTypes: input.responseTypes,
            tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
            scopes: input.scopes,
            clientUri: input.clientUri,
            logoUri: input.logoUri,
            softwareId: input.softwareId,
            softwareVersion: input.softwareVersion,
          },
        });
        expect(result).toEqual(mockClient);
      });

      it('デフォルト値が適用される', async () => {
        const input = {
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          clientName: 'Test Client',
          redirectUris: ['http://localhost:8080/callback'],
        };

        const mockClient = {
          id: 'client-db-id',
          clientId: input.clientId,
          clientName: input.clientName,
          redirectUris: input.redirectUris,
          grantTypes: ['authorization_code'],
          responseTypes: ['code'],
          tokenEndpointAuthMethod: 'none',
          scopes: [],
          isActive: true,
          clientIdIssuedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrisma.oAuthClient.create.mockResolvedValue(mockClient);

        await repository.createClient(input);

        expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            grantTypes: ['authorization_code'],
            responseTypes: ['code'],
            tokenEndpointAuthMethod: 'none',
            scopes: [],
          }),
        });
      });
    });

    describe('findClientByClientId', () => {
      it('アクティブなクライアントを取得できる', async () => {
        const mockClient = {
          id: 'client-db-id',
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          clientName: 'Test Client',
          isActive: true,
        };

        mockPrisma.oAuthClient.findUnique.mockResolvedValue(mockClient);

        const result = await repository.findClientByClientId('550e8400-e29b-41d4-a716-446655440000');

        expect(mockPrisma.oAuthClient.findUnique).toHaveBeenCalledWith({
          where: {
            clientId: '550e8400-e29b-41d4-a716-446655440000',
            isActive: true,
          },
        });
        expect(result).toEqual(mockClient);
      });

      it('クライアントが見つからない場合はnullを返す', async () => {
        mockPrisma.oAuthClient.findUnique.mockResolvedValue(null);

        const result = await repository.findClientByClientId('non-existent-id');

        expect(result).toBeNull();
      });
    });
  });

  describe('認可コード操作', () => {
    describe('createAuthorizationCode', () => {
      it('新しい認可コードを作成できる', async () => {
        const input = {
          code: 'auth-code-123',
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'user-123',
          redirectUri: 'http://localhost:8080/callback',
          scopes: ['mcp:read'],
          codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          codeChallengeMethod: 'S256',
          resource: 'http://localhost:3002',
          expiresAt: new Date(Date.now() + 600000),
        };

        const mockAuthCode = {
          id: 'auth-code-db-id',
          ...input,
          usedAt: null,
          createdAt: new Date(),
        };

        mockPrisma.oAuthAuthorizationCode.create.mockResolvedValue(mockAuthCode);

        const result = await repository.createAuthorizationCode(input);

        expect(mockPrisma.oAuthAuthorizationCode.create).toHaveBeenCalledWith({
          data: {
            code: input.code,
            clientId: input.clientId,
            userId: input.userId,
            redirectUri: input.redirectUri,
            scopes: input.scopes,
            codeChallenge: input.codeChallenge,
            codeChallengeMethod: input.codeChallengeMethod,
            resource: input.resource,
            expiresAt: input.expiresAt,
          },
        });
        expect(result).toEqual(mockAuthCode);
      });
    });

    describe('findAuthorizationCodeByCode', () => {
      it('認可コードをクライアント・ユーザー情報付きで取得できる', async () => {
        const mockAuthCode = {
          id: 'auth-code-db-id',
          code: 'auth-code-123',
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'user-123',
          client: { clientName: 'Test Client' },
          user: { name: 'Test User' },
        };

        mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(mockAuthCode);

        const result = await repository.findAuthorizationCodeByCode('auth-code-123');

        expect(mockPrisma.oAuthAuthorizationCode.findUnique).toHaveBeenCalledWith({
          where: { code: 'auth-code-123' },
          include: {
            client: true,
            user: true,
          },
        });
        expect(result).toEqual(mockAuthCode);
      });

      it('認可コードが見つからない場合はnullを返す', async () => {
        mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(null);

        const result = await repository.findAuthorizationCodeByCode('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('markAuthorizationCodeAsUsed', () => {
      it('認可コードを使用済みにマークできる', async () => {
        mockPrisma.oAuthAuthorizationCode.update.mockResolvedValue({});

        await repository.markAuthorizationCodeAsUsed('auth-code-123');

        expect(mockPrisma.oAuthAuthorizationCode.update).toHaveBeenCalledWith({
          where: { code: 'auth-code-123' },
          data: { usedAt: expect.any(Date) },
        });
      });
    });
  });

  describe('アクセストークン操作', () => {
    describe('createAccessToken', () => {
      it('新しいアクセストークンを作成できる', async () => {
        const input = {
          tokenHash: 'hashed-token',
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'user-123',
          scopes: ['mcp:read', 'mcp:write'],
          audience: 'http://localhost:3002',
          expiresAt: new Date(Date.now() + 3600000),
        };

        const mockToken = {
          id: 'token-db-id',
          ...input,
          revokedAt: null,
          createdAt: new Date(),
        };

        mockPrisma.oAuthAccessToken.create.mockResolvedValue(mockToken);

        const result = await repository.createAccessToken(input);

        expect(mockPrisma.oAuthAccessToken.create).toHaveBeenCalledWith({
          data: {
            tokenHash: input.tokenHash,
            clientId: input.clientId,
            userId: input.userId,
            scopes: input.scopes,
            audience: input.audience,
            expiresAt: input.expiresAt,
          },
        });
        expect(result).toEqual(mockToken);
      });
    });

    describe('findAccessTokenByHash', () => {
      it('アクセストークンをクライアント・ユーザー情報付きで取得できる', async () => {
        const mockToken = {
          id: 'token-db-id',
          tokenHash: 'hashed-token',
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          userId: 'user-123',
          client: { clientName: 'Test Client' },
          user: { name: 'Test User' },
        };

        mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue(mockToken);

        const result = await repository.findAccessTokenByHash('hashed-token');

        expect(mockPrisma.oAuthAccessToken.findUnique).toHaveBeenCalledWith({
          where: { tokenHash: 'hashed-token' },
          include: {
            client: true,
            user: true,
          },
        });
        expect(result).toEqual(mockToken);
      });

      it('トークンが見つからない場合はnullを返す', async () => {
        mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue(null);

        const result = await repository.findAccessTokenByHash('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('revokeAccessToken', () => {
      it('アクセストークンを失効させられる', async () => {
        mockPrisma.oAuthAccessToken.update.mockResolvedValue({});

        await repository.revokeAccessToken('hashed-token');

        expect(mockPrisma.oAuthAccessToken.update).toHaveBeenCalledWith({
          where: { tokenHash: 'hashed-token' },
          data: { revokedAt: expect.any(Date) },
        });
      });
    });

    describe('revokeAllAccessTokensByUserId', () => {
      it('ユーザーの全アクセストークンを失効させられる', async () => {
        mockPrisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 3 });

        await repository.revokeAllAccessTokensByUserId('user-123');

        expect(mockPrisma.oAuthAccessToken.updateMany).toHaveBeenCalledWith({
          where: {
            userId: 'user-123',
            revokedAt: null,
          },
          data: { revokedAt: expect.any(Date) },
        });
      });

      it('特定のクライアントのトークンのみを失効させられる', async () => {
        mockPrisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 1 });

        await repository.revokeAllAccessTokensByUserId('user-123', '550e8400-e29b-41d4-a716-446655440000');

        expect(mockPrisma.oAuthAccessToken.updateMany).toHaveBeenCalledWith({
          where: {
            userId: 'user-123',
            clientId: '550e8400-e29b-41d4-a716-446655440000',
            revokedAt: null,
          },
          data: { revokedAt: expect.any(Date) },
        });
      });
    });
  });
});
