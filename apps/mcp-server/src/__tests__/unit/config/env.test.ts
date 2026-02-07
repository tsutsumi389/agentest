import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn(), child: vi.fn() };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../../../utils/logger.js', () => ({ logger: mockLogger }));

import { nodeEnvSchema } from '@agentest/shared/config';
import { createEnvSchema } from '../../../config/env.js';

type EnvSchema = ReturnType<typeof createEnvSchema>;
type EnvType = z.infer<EnvSchema>;
type ValidationResult =
  | { success: true; data: EnvType }
  | { success: false; errors: z.inferFlattenedErrors<EnvSchema>['fieldErrors'] };

// テスト用のベース環境変数（必須フィールド）
const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
};

// 本番環境テスト用の環境変数（すべてのシークレットを明示的に設定）
const productionSecrets = {
  JWT_ACCESS_SECRET: 'production-access-secret-key-32chars!',
  JWT_REFRESH_SECRET: 'production-refresh-secret-key-32chars',
  INTERNAL_API_SECRET: 'production-internal-api-secret-32chars',
};

function validateEnv(envVars: Record<string, string | undefined>, isProduction = false): ValidationResult {
  const envSchema = createEnvSchema(isProduction);
  const parsed = envSchema.safeParse(envVars);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }
  return { success: true, data: parsed.data };
}

describe('config/env', () => {
  describe('envSchema', () => {
    it('有効な環境変数でバリデーション成功', () => {
      const result = validateEnv({
        ...baseEnv,
        ...productionSecrets,
        NODE_ENV: 'production',
        PORT: '3002',
        HOST: 'localhost',
      }, true);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('production');
        expect(result.data.PORT).toBe(3002);
        expect(result.data.HOST).toBe('localhost');
        expect(result.data.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
      }
    });

    it('デフォルト値が適用される（development）', () => {
      const result = validateEnv(baseEnv);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('development');
        expect(result.data.PORT).toBe(3002);
        expect(result.data.HOST).toBe('0.0.0.0');
        expect(result.data.JWT_ACCESS_SECRET).toBe('development-access-secret-key-32ch');
        expect(result.data.JWT_REFRESH_SECRET).toBe('development-refresh-secret-key-32ch');
        expect(result.data.INTERNAL_API_SECRET).toBe('development-internal-api-secret-32ch');
        expect(result.data.CORS_ORIGIN).toBe('http://localhost:5173');
        expect(result.data.API_INTERNAL_URL).toBe('http://api:3001');
        expect(result.data.MCP_SERVER_URL).toBe('http://localhost:3002');
        expect(result.data.API_URL).toBe('http://localhost:3001');
      }
    });

    it('PORTが数値に変換される', () => {
      const result = validateEnv({
        ...baseEnv,
        PORT: '8080',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(8080);
        expect(typeof result.data.PORT).toBe('number');
      }
    });

    it('NODE_ENVが不正な値でエラー', () => {
      const result = validateEnv({
        ...baseEnv,
        NODE_ENV: 'invalid',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.NODE_ENV).toBeDefined();
      }
    });

    it('DATABASE_URLが不正なURLでエラー', () => {
      const result = validateEnv({
        DATABASE_URL: 'not-a-url',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.DATABASE_URL).toBeDefined();
      }
    });

    it('DATABASE_URLが未設定でエラー', () => {
      const result = validateEnv({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.DATABASE_URL).toBeDefined();
      }
    });

    it('NODE_ENVがtestで有効', () => {
      const result = validateEnv({
        ...baseEnv,
        NODE_ENV: 'test',
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
          ...baseEnv,
          NODE_ENV: 'production',
          JWT_REFRESH_SECRET: productionSecrets.JWT_REFRESH_SECRET,
          INTERNAL_API_SECRET: productionSecrets.INTERNAL_API_SECRET,
        },
        true,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.JWT_ACCESS_SECRET).toBeDefined();
      }
    });

    it('production環境でJWT_REFRESH_SECRET未設定はエラー', () => {
      const result = validateEnv(
        {
          ...baseEnv,
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: productionSecrets.JWT_ACCESS_SECRET,
          INTERNAL_API_SECRET: productionSecrets.INTERNAL_API_SECRET,
        },
        true,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.JWT_REFRESH_SECRET).toBeDefined();
      }
    });

    it('production環境でINTERNAL_API_SECRET未設定はエラー', () => {
      const result = validateEnv(
        {
          ...baseEnv,
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: productionSecrets.JWT_ACCESS_SECRET,
          JWT_REFRESH_SECRET: productionSecrets.JWT_REFRESH_SECRET,
        },
        true,
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.INTERNAL_API_SECRET).toBeDefined();
      }
    });

    it('production環境ですべてのシークレットを明示的に設定すれば成功', () => {
      const result = validateEnv(
        {
          ...baseEnv,
          ...productionSecrets,
          NODE_ENV: 'production',
        },
        true,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.JWT_ACCESS_SECRET).toBe(productionSecrets.JWT_ACCESS_SECRET);
        expect(result.data.JWT_REFRESH_SECRET).toBe(productionSecrets.JWT_REFRESH_SECRET);
        expect(result.data.INTERNAL_API_SECRET).toBe(productionSecrets.INTERNAL_API_SECRET);
      }
    });

    it('非production環境ではシークレットのデフォルト値が使用される', () => {
      const result = validateEnv(baseEnv, false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.JWT_ACCESS_SECRET).toBe('development-access-secret-key-32ch');
        expect(result.data.JWT_REFRESH_SECRET).toBe('development-refresh-secret-key-32ch');
        expect(result.data.INTERNAL_API_SECRET).toBe('development-internal-api-secret-32ch');
      }
    });

    it('INTERNAL_API_SECRETが32文字未満でエラー', () => {
      const result = validateEnv({
        ...baseEnv,
        INTERNAL_API_SECRET: 'short-secret',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.INTERNAL_API_SECRET).toBeDefined();
      }
    });
  });
});
