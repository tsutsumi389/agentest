import { z } from 'zod';
import { nodeEnvSchema } from '@agentest/shared/config';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'env' });

// 環境変数スキーマを生成する（本番環境ではシークレットの明示的な設定を必須にする）
export function createEnvSchema(isProduction: boolean) {
  return z.object({
    // サーバー設定
    NODE_ENV: nodeEnvSchema,
    PORT: z.coerce.number().default(3002),
    HOST: z.string().default('0.0.0.0'),

    // データベース
    DATABASE_URL: z.string().url(),

    // JWT（認証用）
    // 本番環境ではデフォルト値なし（必須）、開発環境ではデフォルト値あり
    JWT_ACCESS_SECRET: isProduction
      ? z.string().min(32)
      : z.string().min(32).default('development-access-secret-key-32ch'),
    JWT_REFRESH_SECRET: isProduction
      ? z.string().min(32)
      : z.string().min(32).default('development-refresh-secret-key-32ch'),

    // CORS
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    // 内部API（API サーバーとの通信）
    API_INTERNAL_URL: z.string().url().default('http://api:3001'),
    INTERNAL_API_SECRET: isProduction
      ? z.string().min(32)
      : z.string().min(32).default('development-internal-api-secret-32ch'),

    // Redis（トークンキャッシュ用、未設定時はキャッシュ無効で動作）
    REDIS_URL: z.string().url().optional(),

    // OAuth 2.1 Resource Server (RFC 9728)
    MCP_SERVER_URL: z.string().url().default('http://localhost:3002'),
    // AUTH_SERVER_URLはAPI_URLと同じ値のため、API_URLを使用
    API_URL: z.string().url().default('http://localhost:3001'),
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

export type Env = z.infer<ReturnType<typeof createEnvSchema>>;
