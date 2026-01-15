import rateLimit from 'express-rate-limit';

// テスト環境ではレートリミットをスキップ
const isTest = process.env.NODE_ENV === 'test';

/**
 * 一般API用レート制限
 * 15分間で300リクエストまで
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 300, // IP毎に300リクエスト（Webフロント+MCP併用を考慮）
  standardHeaders: true, // RateLimit-* ヘッダーを返す
  legacyHeaders: false, // X-RateLimit-* ヘッダーを無効化
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'リクエストが多すぎます。しばらくしてから再試行してください。',
      statusCode: 429,
    },
  },
  keyGenerator: (req) => {
    // X-Forwarded-For ヘッダーまたはIPアドレスを使用
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
  },
  skip: () => isTest, // テスト環境ではスキップ
});

/**
 * 認証エンドポイント用レート制限
 * 1時間で5リクエストまで（ブルートフォース対策）
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: 10, // IP毎に10リクエスト
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '認証の試行回数が多すぎます。しばらくしてから再試行してください。',
      statusCode: 429,
    },
  },
  skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
  skip: () => isTest, // テスト環境ではスキップ
});

/**
 * 厳格なレート制限（APIトークン生成など）
 * 1時間で3リクエストまで
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'この操作の試行回数が多すぎます。しばらくしてから再試行してください。',
      statusCode: 429,
    },
  },
  skip: () => isTest, // テスト環境ではスキップ
});
