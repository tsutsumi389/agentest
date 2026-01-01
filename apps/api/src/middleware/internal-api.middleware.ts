import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * 内部API認証ミドルウェア
 * 共有シークレットトークンで認証を行う（MCP↔API間通信用）
 */
export function requireInternalApiAuth() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['x-internal-api-key'];

    if (!authHeader || authHeader !== env.INTERNAL_API_SECRET) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or missing internal API key',
      });
      return;
    }

    next();
  };
}
