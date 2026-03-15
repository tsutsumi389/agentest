import { z } from 'zod';
import { nodeEnvSchema } from '@agentest/shared/config';
import { logger as baseLogger } from './utils/logger.js';

const logger = baseLogger.child({ module: 'config' });

// 環境変数スキーマを生成する（本番環境ではJWTシークレットの明示的な設定を必須にする）
export function createEnvSchema(isProduction: boolean) {
  return z.object({
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().default(3002),
    HOST: z.string().default('0.0.0.0'),

    // Redis
    REDIS_URL: z.string().url(),

    // JWT
    JWT_ACCESS_SECRET: isProduction
      ? z.string().min(32)
      : z.string().min(32).default('development-access-secret-key-32ch'),
  });
}

// NODE_ENVをZodスキーマでパースしてから本番環境かどうかを判定
// （process.env.NODE_ENVの直接参照ではZodスキーマのデフォルト値と乖離する可能性があるため）
const nodeEnv = nodeEnvSchema.parse(process.env.NODE_ENV);
const envSchema = createEnvSchema(nodeEnv === 'production');

// 環境変数を検証
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    logger.error(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      '環境変数のバリデーションエラー'
    );
    throw new Error('環境変数が不正です');
  }

  return parsed.data;
}

export const env = validateEnv();
