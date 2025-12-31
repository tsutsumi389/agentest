import { z } from 'zod';

// 環境変数スキーマ
const envSchema = z.object({
  // サーバー設定
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3002),
  HOST: z.string().default('0.0.0.0'),

  // データベース
  DATABASE_URL: z.string().url(),

  // JWT（認証用）
  JWT_ACCESS_SECRET: z.string().min(32).default('development-access-secret-key-32ch'),
  JWT_REFRESH_SECRET: z.string().min(32).default('development-refresh-secret-key-32ch'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
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
