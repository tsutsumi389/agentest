import type { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../lib/redis-store.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'rate-limiter' });

/** Redisキーのプレフィックス */
export const RATE_LIMIT_PREFIX = 'ratelimit:';

/**
 * レート制限オプション
 */
interface RateLimitOptions {
  /** ウィンドウ内の最大リクエスト数 */
  max: number;
  /** ウィンドウサイズ（ミリ秒） */
  windowMs: number;
  /**
   * ルート識別子（Redisキーに使用）
   * req.pathはクエリパラメータ等で迂回可能なため、固定文字列を使う
   */
  routeId: string;
  /** レスポンスに含めるエラーメッセージ */
  message?: string;
  /** リクエストからキーを生成する関数（デフォルト: userId or IP） */
  keyGenerator?: (req: Request) => string;
}

/**
 * デフォルトのキー生成器
 *
 * 認証済みユーザーはuserId、未認証はIPアドレスをキーとする。
 * 本番環境では app.set('trust proxy', 1) の設定が必須。
 */
function defaultKeyGenerator(req: Request): string {
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  return `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
}

/**
 * Redis Sliding Windowベースのレート制限ミドルウェア
 *
 * アルゴリズム: Redis Sorted Set を使用したSliding Window
 * - スコア = タイムスタンプ、メンバー = ユニークID
 * - 古いエントリを削除 → 新しいエントリを追加 → カウント
 *
 * フォールバック:
 * - Redis未設定時: リクエストを許可（開発環境用）
 * - Redisエラー時: リクエストを許可（可用性優先）
 */
export function rateLimiter(options: RateLimitOptions) {
  const {
    max,
    windowMs,
    routeId,
    message = 'リクエストが多すぎます。しばらく待ってから再試行してください',
    keyGenerator = defaultKeyGenerator,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = getRedisClient();

    // Redis未設定の場合はスキップ
    if (!redis) {
      next();
      return;
    }

    try {
      const clientKey = keyGenerator(req);
      // routeIdを使用してクエリパラメータによるバイパスを防止
      const redisKey = `${RATE_LIMIT_PREFIX}${routeId}:${clientKey}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Sliding Windowアルゴリズム（パイプラインでアトミックに実行）
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
      pipeline.zcard(redisKey);
      pipeline.pexpire(redisKey, windowMs);

      const results = await pipeline.exec();
      if (!results || results.length < 4) {
        throw new Error('レート制限パイプラインの結果が不正です');
      }

      const requestCount = results[2]?.[1] as number;

      // レスポンスヘッダーにレート制限情報を追加
      const remaining = Math.max(0, max - requestCount);
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));

      if (requestCount > max) {
        logger.warn({ clientKey, routeId, requestCount, max }, 'レート制限超過');
        res.set('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            statusCode: 429,
          },
        });
        return;
      }

      next();
    } catch (error) {
      // Redisエラー時はリクエストを許可（可用性優先）
      logger.error({ error }, 'レート制限チェック中にエラーが発生');
      next();
    }
  };
}
