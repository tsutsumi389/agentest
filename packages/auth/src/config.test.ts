import { describe, it, expect } from 'vitest';
import { createAuthConfig } from './config.js';

describe('config', () => {
  describe('createAuthConfig', () => {
    it('環境変数からJWT設定を作成する', () => {
      const env = {
        JWT_ACCESS_SECRET: 'my-access-secret',
        JWT_REFRESH_SECRET: 'my-refresh-secret',
        JWT_ACCESS_EXPIRES_IN: '30m',
        JWT_REFRESH_EXPIRES_IN: '14d',
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.jwt.accessSecret).toBe('my-access-secret');
      expect(config.jwt.refreshSecret).toBe('my-refresh-secret');
      expect(config.jwt.accessExpiry).toBe('30m');
      expect(config.jwt.refreshExpiry).toBe('14d');
    });

    it('JWT設定にデフォルト値を使用する', () => {
      const env = {} as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.jwt.accessSecret).toBe('dev-access-secret');
      expect(config.jwt.refreshSecret).toBe('dev-refresh-secret');
      expect(config.jwt.accessExpiry).toBe('15m');
      expect(config.jwt.refreshExpiry).toBe('7d');
    });

    it('本番環境でセキュアなクッキー設定を使用する', () => {
      const env = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'prod-access-secret',
        JWT_REFRESH_SECRET: 'prod-refresh-secret',
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.cookie.httpOnly).toBe(true);
      expect(config.cookie.secure).toBe(true);
      expect(config.cookie.sameSite).toBe('strict');
      expect(config.cookie.path).toBe('/');
    });

    it('本番環境でJWT_ACCESS_SECRETがない場合エラーをスローする', () => {
      const env = {
        NODE_ENV: 'production',
        JWT_REFRESH_SECRET: 'prod-refresh-secret',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => createAuthConfig(env)).toThrow(
        'JWT_ACCESS_SECRET is required in production environment'
      );
    });

    it('本番環境でJWT_REFRESH_SECRETがない場合エラーをスローする', () => {
      const env = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'prod-access-secret',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => createAuthConfig(env)).toThrow(
        'JWT_REFRESH_SECRET is required in production environment'
      );
    });

    it('開発環境でセキュアでないクッキー設定を使用する', () => {
      const env = {
        NODE_ENV: 'development',
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.cookie.secure).toBe(false);
    });

    it('GitHub OAuth設定を作成する', () => {
      const env = {
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
        GITHUB_CALLBACK_URL: 'https://example.com/auth/github/callback',
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.oauth.github).toBeDefined();
      expect(config.oauth.github?.clientId).toBe('github-client-id');
      expect(config.oauth.github?.clientSecret).toBe('github-client-secret');
      expect(config.oauth.github?.callbackUrl).toBe('https://example.com/auth/github/callback');
    });

    it('GitHub OAuth設定でデフォルトのコールバックURLを使用する', () => {
      const env = {
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.oauth.github?.callbackUrl).toBe('http://localhost:3001/auth/github/callback');
    });

    it('GitHub設定が不完全な場合はundefinedになる', () => {
      const env = {
        GITHUB_CLIENT_ID: 'github-client-id',
        // GITHUB_CLIENT_SECRET is missing
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.oauth.github).toBeUndefined();
    });

    it('Google OAuth設定を作成する', () => {
      const env = {
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        GOOGLE_CALLBACK_URL: 'https://example.com/auth/google/callback',
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.oauth.google).toBeDefined();
      expect(config.oauth.google?.clientId).toBe('google-client-id');
      expect(config.oauth.google?.clientSecret).toBe('google-client-secret');
      expect(config.oauth.google?.callbackUrl).toBe('https://example.com/auth/google/callback');
    });

    it('Google OAuth設定でデフォルトのコールバックURLを使用する', () => {
      const env = {
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.oauth.google?.callbackUrl).toBe('http://localhost:3001/auth/google/callback');
    });

    it('Google設定が不完全な場合はundefinedになる', () => {
      const env = {
        GOOGLE_CLIENT_ID: 'google-client-id',
        // GOOGLE_CLIENT_SECRET is missing
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.oauth.google).toBeUndefined();
    });

    it('複数のOAuthプロバイダーを同時に設定できる', () => {
      const env = {
        GITHUB_CLIENT_ID: 'github-client-id',
        GITHUB_CLIENT_SECRET: 'github-client-secret',
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
      } as unknown as NodeJS.ProcessEnv;

      const config = createAuthConfig(env);

      expect(config.oauth.github).toBeDefined();
      expect(config.oauth.google).toBeDefined();
    });
  });
});
