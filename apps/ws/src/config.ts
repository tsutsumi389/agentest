import { z } from 'zod';

// 環境変数スキーマ
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3002),
  HOST: z.string().default('0.0.0.0'),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32).default('development-access-secret-key-32ch'),
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
