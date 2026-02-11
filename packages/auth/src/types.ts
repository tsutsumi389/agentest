import type { User as PrismaUser } from '@agentest/db';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  type: 'access' | 'refresh';
  jti: string; // JWT ID（トークンの一意性を保証）
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthConfig {
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiry: string;
    refreshExpiry: string;
  };
  cookie: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    path: string;
  };
  oauth: {
    github?: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
    google?: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
  };
}

export interface OAuthProfile {
  provider: 'github' | 'google';
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Express Requestの拡張
declare global {
  namespace Express {
    interface Request {
      user?: PrismaUser;
      token?: JwtPayload;
    }
  }
}
