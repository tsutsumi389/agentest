import { z } from 'zod';

// 本番環境かどうかを判定
const isProduction = process.env.NODE_ENV === 'production';

// 環境変数スキーマ
const envSchema = z.object({
  // サーバー設定
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
  INTERNAL_API_SECRET: z.string().min(32).default('development-internal-api-secret-32ch'),
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
