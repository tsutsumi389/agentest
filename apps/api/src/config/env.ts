import { z } from 'zod';

// 本番環境かどうかを判定
const isProduction = process.env.NODE_ENV === 'production';

// 環境変数スキーマ
const envSchema = z.object({
  // サーバー設定
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),

  // OAuth 2.1 Authorization Server
  API_BASE_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

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
});

// 環境変数を検証
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ 環境変数のバリデーションエラー:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('環境変数が不正です');
  }

  return parsed.data;
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;
