/**
 * pino-http ベースのリクエストロガーミドルウェア
 */

import { pinoHttp, type Options } from 'pino-http';
import type { Request, Response, NextFunction } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../utils/logger.js';
import { requestContext } from '../lib/request-context.js';

/**
 * pino-http ミドルウェアを作成する
 */
const options: Options<IncomingMessage, ServerResponse> = {
  logger,
  // リクエストIDの生成
  genReqId: (req) => {
    const existing = req.headers['x-request-id'];
    if (existing) return Array.isArray(existing) ? existing[0] : existing;
    return crypto.randomUUID();
  },
  // ステータスコードに応じたログレベル
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error';
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
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        accept: req.headers.accept,
        'x-request-id': req.headers['x-request-id'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  // テスト時はリクエストの自動ログを無効化
  autoLogging: process.env.NODE_ENV !== 'test',
};

export const httpLogger = pinoHttp(options);

/**
 * リクエストIDをreq.requestIdにコピーする後方互換ミドルウェア
 */
export function attachRequestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.id ?? crypto.randomUUID();
  req.requestId = id as string;
  res.setHeader('X-Request-ID', id as string);
  next();
}

/**
 * AsyncLocalStorageでリクエストコンテキストを開始するミドルウェア
 * attachRequestId の後に配置し、requestIdを非同期処理全体に伝搬する
 *
 * 通常はattachRequestIdで設定済みだが、単体使用時に備えてフォールバックあり
 */
export function runWithRequestContext(req: Request, _res: Response, next: NextFunction): void {
  const requestId = req.requestId ?? crypto.randomUUID();
  requestContext.run({ requestId }, () => next());
}
