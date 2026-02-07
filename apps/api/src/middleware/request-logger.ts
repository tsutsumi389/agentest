/**
 * pino-http ベースのリクエストロガーミドルウェア
 */

import pinoHttp from 'pino-http';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * pino-http ミドルウェアを作成する
 */
export const httpLogger = pinoHttp({
  logger,
  // リクエストIDの生成
  genReqId: (req) => {
    const existing = req.headers['x-request-id'];
    if (existing) return Array.isArray(existing) ? existing[0] : existing;
    return crypto.randomUUID();
  },
  // ステータスコードに応じたログレベル
  customLogLevel: (_req, res, error) => {
    if (error || (res.statusCode >= 500)) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // 機密ヘッダーのマスク
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      headers: {
        ...req.headers,
        ...(req.headers.authorization && { authorization: '[REDACTED]' }),
        ...(req.headers.cookie && { cookie: '[REDACTED]' }),
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  // テスト時はリクエストの自動ログを無効化
  autoLogging: process.env.NODE_ENV !== 'test',
});

/**
 * リクエストIDをreq.requestIdにコピーする後方互換ミドルウェア
 */
export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.id ?? crypto.randomUUID();
  req.requestId = id as string;
  res.setHeader('X-Request-ID', id as string);
  next();
}
