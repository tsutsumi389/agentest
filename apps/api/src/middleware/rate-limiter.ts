import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// テスト環境ではレートリミットをスキップ
const isTest = process.env.NODE_ENV === 'test';

// E2Eテスト用バイパスをチェック（開発環境のみ）
const shouldSkipRateLimit = (req: Request): boolean => {
  if (isTest) return true;
  // 開発環境でX-E2E-Testヘッダーがある場合はスキップ
  if (process.env.NODE_ENV === 'development' && req.headers['x-e2e-test'] === 'true') {
    return true;
  }
  return false;
};

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
  skip: shouldSkipRateLimit, // テスト環境またはE2Eテストではスキップ
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
  skip: shouldSkipRateLimit, // テスト環境またはE2Eテストではスキップ
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
  skip: shouldSkipRateLimit, // テスト環境またはE2Eテストではスキップ
});

/**
 * 課金API用レート制限
 * 1分間で10リクエストまで（不正利用対策）
 */
export const billingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 10, // IP毎に10リクエスト
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '課金操作のリクエストが多すぎます。しばらくしてから再試行してください。',
      statusCode: 429,
    },
  },
  keyGenerator: (req) => {
    // ユーザーIDをキーにする（認証済みの場合）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (req as any).user?.id;
    if (userId) {
      return `billing:${userId}`;
    }
    // 認証前はIPアドレスを使用
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
  },
  skip: shouldSkipRateLimit, // テスト環境またはE2Eテストではスキップ
});

/**
 * 管理者認証エンドポイント用レート制限
 * 15分間で5リクエストまで（ブルートフォース対策）
 */
export const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // IP毎に5リクエスト
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '管理者認証の試行回数が多すぎます。しばらくしてから再試行してください。',
      statusCode: 429,
    },
  },
  keyGenerator: (req) => {
    // X-Forwarded-For ヘッダーまたはIPアドレスを使用
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
  },
  skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
  skip: shouldSkipRateLimit, // テスト環境またはE2Eテストではスキップ
});
