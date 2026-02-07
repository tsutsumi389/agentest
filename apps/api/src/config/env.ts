import { z } from 'zod';
import { createLogger } from '@agentest/shared/logger';

// env.ts は他のモジュールより先に評価されるため、共有loggerではなく直接生成する
const logger = createLogger({ service: 'api' }).child({ module: 'env' });

// NODE_ENVスキーマ（isProduction判定とenvSchemaで共有）
const nodeEnvSchema = z.enum(['development', 'production', 'test']).default('development');

// NODE_ENVをZodスキーマでパースしてから本番環境かどうかを判定
// （process.env.NODE_ENVの直接参照ではZodスキーマのデフォルト値と乖離する可能性があるため）
const isProduction = nodeEnvSchema.parse(process.env.NODE_ENV) === 'production';

// 環境変数スキーマ
const envSchema = z.object({
  // サーバー設定
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),

  // OAuth 2.1 Authorization Server
  API_BASE_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  ADMIN_FRONTEND_URL: z.string().url().default('http://localhost:5174'),

  // データベース
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // JWT（認証用）
  // 本番環境ではデフォルト値なし（必須）、開発環境ではデフォルト値あり
  JWT_ACCESS_SECRET: isProduction
    ? z.string().min(32)
    : z.string().min(32).default('development-access-secret-key-32ch'),
  JWT_REFRESH_SECRET: isProduction
    ? z.string().min(32)
    : z.string().min(32).default('development-refresh-secret-key-32ch'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // OAuth
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // 内部API認証（MCP↔API間通信）
  // 本番環境ではデフォルト値なし（必須）、開発環境ではデフォルト値あり
  INTERNAL_API_SECRET: isProduction
    ? z.string().min(32)
    : z.string().min(32).default('development-internal-api-secret-32ch'),

  // MinIO/S3
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('agentest'),
  S3_REGION: z.string().default('us-east-1'),

  // Payment (Stripe)
  PAYMENT_GATEWAY: z.enum(['mock', 'stripe']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_TEAM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_TEAM_YEARLY: z.string().optional(),

  // SMTP（メール送信）
  SMTP_HOST: z.string().default('mailpit'),       // dev/staging: mailpit
  SMTP_PORT: z.coerce.number().default(1025),     // dev/staging: 1025
  SMTP_USER: z.string().optional(),               // mailpitでは不要
  SMTP_PASS: z.string().optional(),               // mailpitでは不要
  SMTP_FROM: z.string().email().default('noreply@agentest.local'),
  SMTP_SECURE: z.coerce.boolean().default(false), // 本番: true
});

// 環境変数を検証
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    logger.fatal({ fieldErrors: parsed.error.flatten().fieldErrors }, '環境変数のバリデーションエラー');
    throw new Error('環境変数が不正です');
  }

  return parsed.data;
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;
