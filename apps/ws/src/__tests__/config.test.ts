import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// config.tsと同じロジックでスキーマを生成する関数
function createEnvSchema(isProduction: boolean) {
  return z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3002),
    HOST: z.string().default('0.0.0.0'),
    REDIS_URL: z.string().url(),
    JWT_ACCESS_SECRET: isProduction
      ? z.string().min(32)
      : z.string().min(32).default('development-access-secret-key-32ch'),
  });
}

type EnvSchema = ReturnType<typeof createEnvSchema>;
type EnvType = z.infer<EnvSchema>;
type ValidationResult =
  | { success: true; data: EnvType }
  | { success: false; errors: z.inferFlattenedErrors<EnvSchema>['fieldErrors'] };

function validateEnv(envVars: Record<string, string | undefined>, isProduction = false): ValidationResult {
  const envSchema = createEnvSchema(isProduction);
  const parsed = envSchema.safeParse(envVars);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }
  return { success: true, data: parsed.data };
}

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('envSchema', () => {
    it('有効な環境変数でバリデーション成功', () => {
      const result = validateEnv({
        NODE_ENV: 'production',
        PORT: '3002',
        HOST: 'localhost',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'this-is-a-super-secret-key-32chars!',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('production');
        expect(result.data.PORT).toBe(3002);
        expect(result.data.HOST).toBe('localhost');
        expect(result.data.REDIS_URL).toBe('redis://localhost:6379');
        expect(result.data.JWT_ACCESS_SECRET).toBe('this-is-a-super-secret-key-32chars!');
      }
    });

    it('デフォルト値が適用される（development）', () => {
      const result = validateEnv({
        REDIS_URL: 'redis://localhost:6379',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('development');
        expect(result.data.PORT).toBe(3002);
        expect(result.data.HOST).toBe('0.0.0.0');
        expect(result.data.JWT_ACCESS_SECRET).toBe('development-access-secret-key-32ch');
      }
    });

    it('PORTが数値に変換される', () => {
      const result = validateEnv({
        PORT: '8080',
        REDIS_URL: 'redis://localhost:6379',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(8080);
        expect(typeof result.data.PORT).toBe('number');
      }
    });

    it('NODE_ENVが不正な値でエラー', () => {
      const result = validateEnv({
        NODE_ENV: 'invalid',
        REDIS_URL: 'redis://localhost:6379',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.NODE_ENV).toBeDefined();
      }
    });

    it('REDIS_URLが不正なURLでエラー', () => {
      const result = validateEnv({
        REDIS_URL: 'not-a-url',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.REDIS_URL).toBeDefined();
      }
    });

    it('REDIS_URLが未設定でエラー', () => {
      const result = validateEnv({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.REDIS_URL).toBeDefined();
      }
    });

    it('JWT_ACCESS_SECRETが32文字未満でエラー', () => {
      const result = validateEnv({
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'short-secret', // 32文字未満
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.JWT_ACCESS_SECRET).toBeDefined();
      }
    });

    it('NODE_ENVがtestで有効', () => {
      const result = validateEnv({
        NODE_ENV: 'test',
        REDIS_URL: 'redis://localhost:6379',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('test');
      }
    });
  });

  describe('productionガード', () => {
    it('production環境でJWT_ACCESS_SECRET未設定はエラー', () => {
      const result = validateEnv(
        {
          NODE_ENV: 'production',
          REDIS_URL: 'redis://localhost:6379',
        },
        true,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.JWT_ACCESS_SECRET).toBeDefined();
      }
    });

    it('production環境でJWT_ACCESS_SECRETを明示的に設定すれば成功', () => {
      const result = validateEnv(
        {
          NODE_ENV: 'production',
          REDIS_URL: 'redis://localhost:6379',
          JWT_ACCESS_SECRET: 'production-secret-key-must-be-at-least-32-chars',
        },
        true,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.JWT_ACCESS_SECRET).toBe('production-secret-key-must-be-at-least-32-chars');
      }
    });

    it('非production環境ではJWT_ACCESS_SECRETのデフォルト値が使用される', () => {
      const result = validateEnv(
        {
          REDIS_URL: 'redis://localhost:6379',
        },
        false,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.JWT_ACCESS_SECRET).toBe('development-access-secret-key-32ch');
      }
    });
  });
});
