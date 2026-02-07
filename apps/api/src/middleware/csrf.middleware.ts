import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'csrf' });

/**
 * CSRF保護ミドルウェア
 *
 * Origin/Refererヘッダーを検証して、信頼できるオリジンからのリクエストのみ許可する。
 * フロントエンドからのPOSTリクエスト（同意画面など）に使用。
 */
export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // GET/HEAD/OPTIONSリクエストはCSRF対策不要
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // 許可するオリジンのリスト
    const allowedOrigins = [
      env.FRONTEND_URL,
      env.ADMIN_FRONTEND_URL,
      env.API_BASE_URL,
    ].map((url) => url.replace(/\/$/, '')); // 末尾スラッシュを除去

    // Originヘッダーがある場合は検証
    if (origin) {
      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return next();
      }

      logger.warn({ origin, allowedOrigins }, 'リクエストをブロックしました: 不正なorigin');
      res.status(403).json({
        error: 'forbidden',
        error_description: 'Invalid request origin',
      });
      return;
    }

    // Refererヘッダーがある場合は検証
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = refererUrl.origin.replace(/\/$/, '');
        if (allowedOrigins.includes(refererOrigin)) {
          return next();
        }
      } catch {
        // URLパースエラーは無視して拒否
      }

      logger.warn({ referer, allowedOrigins }, 'リクエストをブロックしました: 不正なreferer');
      res.status(403).json({
        error: 'forbidden',
        error_description: 'Invalid request referer',
      });
      return;
    }

    // Origin/Refererがない場合は拒否（ブラウザからの正当なリクエストには必ず含まれる）
    logger.warn('リクエストをブロックしました: originとrefererヘッダーが欠落');
    res.status(403).json({
      error: 'forbidden',
      error_description: 'Missing origin or referer header',
    });
  };
}
