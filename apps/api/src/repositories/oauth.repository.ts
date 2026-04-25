import {
  prisma,
  type PrismaClient,
  type OAuthClient,
  type OAuthAuthorizationCode,
  type OAuthAccessToken,
  type OAuthRefreshToken,
} from '@agentest/db';

/**
 * OAuth Repository インターフェース
 */
export interface IOAuthRepository {
  // クライアント
  createClient(data: CreateClientInput): Promise<OAuthClient>;
  findClientByClientId(clientId: string): Promise<OAuthClient | null>;
  upsertCimdClient(data: UpsertCimdClientInput): Promise<OAuthClient>;
  touchCimdClient(data: TouchCimdClientInput): Promise<OAuthClient>;

  // 認可コード
  createAuthorizationCode(data: CreateAuthorizationCodeInput): Promise<OAuthAuthorizationCode>;
  findAuthorizationCodeByCode(code: string): Promise<OAuthAuthorizationCode | null>;
  markAuthorizationCodeAsUsed(code: string): Promise<void>;

  // アクセストークン
  createAccessToken(data: CreateAccessTokenInput): Promise<OAuthAccessToken>;
  findAccessTokenByHash(tokenHash: string): Promise<OAuthAccessToken | null>;
  revokeAccessToken(tokenHash: string): Promise<void>;
  revokeAllAccessTokensByUserId(userId: string, clientId?: string): Promise<void>;

  // リフレッシュトークン
  createRefreshToken(data: CreateRefreshTokenInput): Promise<OAuthRefreshToken>;
  findRefreshTokenByHash(tokenHash: string): Promise<OAuthRefreshToken | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllRefreshTokensByUserId(userId: string, clientId?: string): Promise<void>;
}

export interface CreateClientInput {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  scopes?: string[];
  clientUri?: string;
  logoUri?: string;
  softwareId?: string;
  softwareVersion?: string;
}

export interface UpsertCimdClientInput {
  /** CIMD URL = clientId */
  clientId: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  scopes: string[];
  clientUri?: string;
  logoUri?: string;
  softwareId?: string;
  softwareVersion?: string;
  jwksUri?: string;
  metadataFetchedAt: Date;
  metadataExpiresAt: Date | null;
  metadataEtag?: string;
}

export interface TouchCimdClientInput {
  clientId: string;
  metadataFetchedAt: Date;
  metadataExpiresAt: Date | null;
  metadataEtag?: string;
}

export interface CreateAuthorizationCodeInput {
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  expiresAt: Date;
}

export interface CreateAccessTokenInput {
  tokenHash: string;
  clientId: string;
  userId: string;
  scopes: string[];
  audience: string;
  expiresAt: Date;
  refreshTokenId?: string;
}

export interface CreateRefreshTokenInput {
  tokenHash: string;
  clientId: string;
  userId: string;
  scopes: string[];
  audience: string;
  expiresAt: Date;
}

/**
 * OAuth Repository 実装
 */
export class OAuthRepository implements IOAuthRepository {
  constructor(private db: PrismaClient = prisma) {}

  // ============================================
  // クライアント操作
  // ============================================

  async createClient(data: CreateClientInput): Promise<OAuthClient> {
    return this.db.oAuthClient.create({
      data: {
        clientId: data.clientId,
        clientName: data.clientName,
        redirectUris: data.redirectUris,
        grantTypes: data.grantTypes ?? ['authorization_code'],
        responseTypes: data.responseTypes ?? ['code'],
        tokenEndpointAuthMethod: data.tokenEndpointAuthMethod ?? 'none',
        scopes: data.scopes ?? [],
        clientUri: data.clientUri,
        logoUri: data.logoUri,
        softwareId: data.softwareId,
        softwareVersion: data.softwareVersion,
      },
    });
  }

  async findClientByClientId(clientId: string): Promise<OAuthClient | null> {
    return this.db.oAuthClient.findUnique({
      where: { clientId, isActive: true },
    });
  }

  async upsertCimdClient(data: UpsertCimdClientInput): Promise<OAuthClient> {
    const fields = {
      clientName: data.clientName,
      redirectUris: data.redirectUris,
      grantTypes: data.grantTypes,
      responseTypes: data.responseTypes,
      tokenEndpointAuthMethod: data.tokenEndpointAuthMethod,
      scopes: data.scopes,
      clientUri: data.clientUri,
      logoUri: data.logoUri,
      softwareId: data.softwareId,
      softwareVersion: data.softwareVersion,
      isCimd: true,
      isActive: true,
      metadataUrl: data.clientId,
      metadataFetchedAt: data.metadataFetchedAt,
      metadataExpiresAt: data.metadataExpiresAt,
      metadataEtag: data.metadataEtag,
      jwksUri: data.jwksUri,
    };
    return this.db.oAuthClient.upsert({
      where: { clientId: data.clientId },
      create: { clientId: data.clientId, ...fields },
      update: fields,
    });
  }

  async touchCimdClient(data: TouchCimdClientInput): Promise<OAuthClient> {
    return this.db.oAuthClient.update({
      where: { clientId: data.clientId },
      data: {
        metadataFetchedAt: data.metadataFetchedAt,
        metadataExpiresAt: data.metadataExpiresAt,
        ...(data.metadataEtag !== undefined && { metadataEtag: data.metadataEtag }),
      },
    });
  }

  // ============================================
  // 認可コード操作
  // ============================================

  async createAuthorizationCode(
    data: CreateAuthorizationCodeInput
  ): Promise<OAuthAuthorizationCode> {
    return this.db.oAuthAuthorizationCode.create({
      data: {
        code: data.code,
        clientId: data.clientId,
        userId: data.userId,
        redirectUri: data.redirectUri,
        scopes: data.scopes,
        codeChallenge: data.codeChallenge,
        codeChallengeMethod: data.codeChallengeMethod,
        resource: data.resource,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findAuthorizationCodeByCode(code: string): Promise<OAuthAuthorizationCode | null> {
    return this.db.oAuthAuthorizationCode.findUnique({
      where: { code },
      include: {
        client: true,
        user: true,
      },
    });
  }

  async markAuthorizationCodeAsUsed(code: string): Promise<void> {
    await this.db.oAuthAuthorizationCode.update({
      where: { code },
      data: { usedAt: new Date() },
    });
  }

  // ============================================
  // アクセストークン操作
  // ============================================

  async createAccessToken(data: CreateAccessTokenInput): Promise<OAuthAccessToken> {
    return this.db.oAuthAccessToken.create({
      data: {
        tokenHash: data.tokenHash,
        clientId: data.clientId,
        userId: data.userId,
        scopes: data.scopes,
        audience: data.audience,
        expiresAt: data.expiresAt,
        refreshTokenId: data.refreshTokenId,
      },
    });
  }

  async findAccessTokenByHash(tokenHash: string): Promise<OAuthAccessToken | null> {
    return this.db.oAuthAccessToken.findUnique({
      where: { tokenHash },
      include: {
        client: true,
        user: true,
      },
    });
  }

  async revokeAccessToken(tokenHash: string): Promise<void> {
    await this.db.oAuthAccessToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllAccessTokensByUserId(userId: string, clientId?: string): Promise<void> {
    await this.db.oAuthAccessToken.updateMany({
      where: {
        userId,
        ...(clientId && { clientId }),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  // ============================================
  // リフレッシュトークン操作
  // ============================================

  async createRefreshToken(data: CreateRefreshTokenInput): Promise<OAuthRefreshToken> {
    return this.db.oAuthRefreshToken.create({
      data: {
        tokenHash: data.tokenHash,
        clientId: data.clientId,
        userId: data.userId,
        scopes: data.scopes,
        audience: data.audience,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<OAuthRefreshToken | null> {
    return this.db.oAuthRefreshToken.findUnique({
      where: { tokenHash },
      include: {
        client: true,
        user: true,
      },
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db.oAuthRefreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllRefreshTokensByUserId(userId: string, clientId?: string): Promise<void> {
    await this.db.oAuthRefreshToken.updateMany({
      where: {
        userId,
        ...(clientId && { clientId }),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}

// デフォルトインスタンス
export const oauthRepository = new OAuthRepository();
