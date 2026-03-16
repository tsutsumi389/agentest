import type { Prisma } from '@agentest/db';
import { env } from './env.js';

// セッション有効期限（7日）
export const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// OAuth連携追加モードを示すクッキー名
export const LINK_MODE_COOKIE = 'oauth_link_mode';

/**
 * 認証設定（requireAuthミドルウェア用）
 * JWT検証とCookie設定を含む
 */
export const authConfig = {
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiry: env.JWT_REFRESH_EXPIRES_IN,
  },
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },
  oauth: {},
};

/**
 * 管理者認証設定
 */
export const adminAuthConfig = {
  /** 管理者セッションのクッキー名 */
  sessionCookie: 'admin_session',
  /** 管理者クッキー設定 */
  cookieOptions: {
    ...authConfig.cookie,
    path: '/admin',
  },
};

/**
 * RefreshTokenとSessionをトランザクション内で作成する共通ヘルパー
 *
 * Prisma interactive transactionは単一コネクションでシリアル実行されるため、
 * Promise.allではなく逐次awaitを使用する
 */
export async function persistAuthSession(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    tokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
  }
): Promise<void> {
  await tx.refreshToken.create({
    data: {
      userId: params.userId,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
    },
  });
  await tx.session.create({
    data: {
      userId: params.userId,
      tokenHash: params.tokenHash,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt: params.expiresAt,
    },
  });
}
