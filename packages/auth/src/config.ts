import type { AuthConfig } from './types.js';

export function createAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  return {
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET || 'dev-access-secret',
      refreshSecret: env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      accessExpiry: env.JWT_ACCESS_EXPIRY || '15m',
      refreshExpiry: env.JWT_REFRESH_EXPIRY || '7d',
    },
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    },
    oauth: {
      github:
        env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
          ? {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
              callbackUrl: env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/github/callback',
            }
          : undefined,
      google:
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
          ? {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              callbackUrl: env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
            }
          : undefined,
    },
  };
}

export const defaultAuthConfig = createAuthConfig(process.env);
