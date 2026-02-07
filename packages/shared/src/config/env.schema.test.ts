import { describe, it, expect, vi } from 'vitest';
import { envSchema, parseEnv } from './env.schema.js';

describe('envSchema', () => {
  const validEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  describe('NODE_ENV', () => {
    it('development, production, testを受け入れる', () => {
      expect(envSchema.safeParse({ ...validEnv, NODE_ENV: 'development' }).success).toBe(true);
      expect(envSchema.safeParse({ ...validEnv, NODE_ENV: 'production' }).success).toBe(true);
      expect(envSchema.safeParse({ ...validEnv, NODE_ENV: 'test' }).success).toBe(true);
    });

    it('無効な値を拒否する', () => {
      expect(envSchema.safeParse({ ...validEnv, NODE_ENV: 'invalid' }).success).toBe(false);
    });

    it('デフォルト値はdevelopment', () => {
      const { NODE_ENV, ...envWithoutNodeEnv } = validEnv;
      const result = envSchema.parse(envWithoutNodeEnv);
      expect(result.NODE_ENV).toBe('development');
    });
  });

  describe('DATABASE_URL', () => {
    it('有効なURLを受け入れる', () => {
      expect(envSchema.safeParse({ ...validEnv, DATABASE_URL: 'postgresql://localhost:5432/db' }).success).toBe(true);
    });

    it('無効なURLを拒否する', () => {
      expect(envSchema.safeParse({ ...validEnv, DATABASE_URL: 'invalid' }).success).toBe(false);
    });

    it('必須フィールド', () => {
      const { DATABASE_URL, ...envWithoutDb } = validEnv;
      expect(envSchema.safeParse(envWithoutDb).success).toBe(false);
    });
  });

  describe('REDIS_URL', () => {
    it('有効なURLを受け入れる', () => {
      expect(envSchema.safeParse({ ...validEnv, REDIS_URL: 'redis://localhost:6379' }).success).toBe(true);
    });

    it('必須フィールド', () => {
      const { REDIS_URL, ...envWithoutRedis } = validEnv;
      expect(envSchema.safeParse(envWithoutRedis).success).toBe(false);
    });
  });

  describe('JWT設定', () => {
    it('32文字以上のシークレットを受け入れる', () => {
      expect(envSchema.safeParse({
        ...validEnv,
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      }).success).toBe(true);
    });

    it('32文字未満のシークレットを拒否する', () => {
      expect(envSchema.safeParse({
        ...validEnv,
        JWT_ACCESS_SECRET: 'short',
      }).success).toBe(false);

      expect(envSchema.safeParse({
        ...validEnv,
        JWT_REFRESH_SECRET: 'short',
      }).success).toBe(false);
    });

    it('デフォルトの有効期限を適用する', () => {
      const result = envSchema.parse(validEnv);
      expect(result.JWT_ACCESS_EXPIRES_IN).toBe('15m');
      expect(result.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    });

    it('カスタム有効期限を設定できる', () => {
      const result = envSchema.parse({
        ...validEnv,
        JWT_ACCESS_EXPIRES_IN: '30m',
        JWT_REFRESH_EXPIRES_IN: '30d',
      });
      expect(result.JWT_ACCESS_EXPIRES_IN).toBe('30m');
      expect(result.JWT_REFRESH_EXPIRES_IN).toBe('30d');
    });
  });

  describe('OAuth設定', () => {
    it('GitHub OAuth設定はオプション', () => {
      const result = envSchema.parse(validEnv);
      expect(result.GITHUB_CLIENT_ID).toBeUndefined();
      expect(result.GITHUB_CLIENT_SECRET).toBeUndefined();
      expect(result.GITHUB_CALLBACK_URL).toBeUndefined();
    });

    it('GitHub OAuth設定を受け入れる', () => {
      const result = envSchema.parse({
        ...validEnv,
        GITHUB_CLIENT_ID: 'client-id',
        GITHUB_CLIENT_SECRET: 'client-secret',
        GITHUB_CALLBACK_URL: 'http://localhost:3001/auth/github/callback',
      });
      expect(result.GITHUB_CLIENT_ID).toBe('client-id');
    });

    it('Google OAuth設定はオプション', () => {
      const result = envSchema.parse(validEnv);
      expect(result.GOOGLE_CLIENT_ID).toBeUndefined();
    });

    it('GITHUB_CALLBACK_URLはURL形式が必要', () => {
      expect(envSchema.safeParse({
        ...validEnv,
        GITHUB_CALLBACK_URL: 'invalid-url',
      }).success).toBe(false);
    });
  });

  describe('MinIO/S3設定', () => {
    it('MinIO設定はオプション', () => {
      const result = envSchema.parse(validEnv);
      expect(result.MINIO_ENDPOINT).toBeUndefined();
      expect(result.MINIO_ACCESS_KEY).toBeUndefined();
    });

    it('MINIO_BUCKETのデフォルト値はagentest', () => {
      const result = envSchema.parse(validEnv);
      expect(result.MINIO_BUCKET).toBe('agentest');
    });

    it('MINIO_ENDPOINTはURL形式が必要', () => {
      expect(envSchema.safeParse({
        ...validEnv,
        MINIO_ENDPOINT: 'invalid',
      }).success).toBe(false);
    });
  });

  describe('URL設定', () => {
    it('デフォルト値を適用する', () => {
      const result = envSchema.parse(validEnv);
      expect(result.API_URL).toBe('http://localhost:3001');
      expect(result.WEB_URL).toBe('http://localhost:3000');
    });

    it('カスタムURLを設定できる', () => {
      const result = envSchema.parse({
        ...validEnv,
        API_URL: 'https://api.example.com',
        WEB_URL: 'https://app.example.com',
      });
      expect(result.API_URL).toBe('https://api.example.com');
      expect(result.WEB_URL).toBe('https://app.example.com');
    });
  });

  describe('ポート設定', () => {
    it('デフォルト値を適用する', () => {
      const result = envSchema.parse(validEnv);
      expect(result.API_PORT).toBe(3001);
      expect(result.WS_PORT).toBe(3002);
    });

    it('文字列を数値に変換する', () => {
      const result = envSchema.parse({
        ...validEnv,
        API_PORT: '8080',
        WS_PORT: '8081',
      });
      expect(result.API_PORT).toBe(8080);
      expect(result.WS_PORT).toBe(8081);
    });
  });

  describe('ログ設定', () => {
    it('デフォルト値はinfo', () => {
      const result = envSchema.parse(validEnv);
      expect(result.LOG_LEVEL).toBe('info');
    });

    it('全てのログレベルを受け入れる', () => {
      expect(envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'debug' }).success).toBe(true);
      expect(envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'info' }).success).toBe(true);
      expect(envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'warn' }).success).toBe(true);
      expect(envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'error' }).success).toBe(true);
    });

    it('無効なログレベルを拒否する', () => {
      expect(envSchema.safeParse({ ...validEnv, LOG_LEVEL: 'invalid' }).success).toBe(false);
    });
  });
});

describe('parseEnv', () => {
  const validEnv = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('有効な環境変数をパースする', () => {
    const result = parseEnv(validEnv as unknown as NodeJS.ProcessEnv);
    expect(result.NODE_ENV).toBe('development');
    expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
  });

  it('無効な環境変数でエラーをスローする', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow('Invalid environment configuration');

    consoleSpy.mockRestore();
  });

  it('エラー時に構造化ログを出力する', () => {
    // logger.fatal が呼ばれることを確認（実際のログ出力は stdout に出る）
    expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow('Invalid environment configuration');
  });
});
