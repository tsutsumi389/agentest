import { describe, it, expect, vi } from 'vitest';
import type { z } from 'zod';

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn(), child: vi.fn() };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../utils/logger.js', () => ({ logger: mockLogger }));

import { nodeEnvSchema } from '@agentest/shared/config';
import { createEnvSchema } from '../config.js';

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
  describe('envSchema', () => {
    it('有効な環境変数でバリデーション成功', () => {
      const result = validateEnv({
        NODE_ENV: 'production',
        PORT: '3002',
        HOST: 'localhost',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'this-is-a-super-secret-key-32chars!',
      }, true);

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
        JWT_ACCESS_SECRET: 'short-secret',
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

  describe('nodeEnvSchema', () => {
    it('未定義の場合はdevelopmentがデフォルト', () => {
      expect(nodeEnvSchema.parse(undefined)).toBe('development');
    });

    it('productionを正しくパース', () => {
      expect(nodeEnvSchema.parse('production')).toBe('production');
    });

    it('不正な値でエラー', () => {
      expect(() => nodeEnvSchema.parse('invalid')).toThrow();
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
