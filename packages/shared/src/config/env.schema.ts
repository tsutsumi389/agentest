import { z } from 'zod';

// NODE_ENVスキーマ（各アプリのisProduction判定とenvSchemaで共有）
export const nodeEnvSchema = z.enum(['development', 'production', 'test']).default('development');
export type NodeEnv = z.infer<typeof nodeEnvSchema>;

export const envSchema = z.object({
  // ノード環境
  NODE_ENV: nodeEnvSchema,

  // データベース
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT認証
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // OAuth - GitHub認証
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),

  // OAuth - Google認証
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // MinIO / S3ストレージ
  MINIO_ENDPOINT: z.string().url().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().default('agentest'),

  // URL設定
  API_URL: z.string().url().default('http://localhost:3001'),
  WEB_URL: z.string().url().default('http://localhost:3000'),

  // ポート設定
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WS_PORT: z.coerce.number().int().min(1).max(65535).default(3002),

  // ログ設定（Pinoのログレベルと一致）
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * 環境変数をパース・バリデーションする（バックエンド専用）
 *
 * 注意: createLogger をモジュールレベルで呼び出すと、バレルエクスポート経由で
 * ブラウザにもロードされ、process 未定義エラーを引き起こす。
 * そのためエラー出力は console.error を使用する。
 */
export function parseEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error(JSON.stringify({
      level: 'fatal',
      service: 'shared',
      module: 'env',
      msg: 'Environment validation failed',
      errors: formatted,
      time: new Date().toISOString(),
    }));
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}
