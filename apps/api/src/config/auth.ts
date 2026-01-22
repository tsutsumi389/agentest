import { env } from './env.js';

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
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/admin',
  },
};
