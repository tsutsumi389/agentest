import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@agentest/db';
import { SessionService } from '../services/session.service.js';

const sessionService = new SessionService();

/**
 * セッション追跡ミドルウェア
 * リクエストからセッションを特定し、req.sessionIdに設定
 * また、認証済みリクエストの場合はセッションの最終活動時刻を更新
 */
export function trackSession() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // クッキーからリフレッシュトークンを取得
      const refreshToken = req.cookies?.refresh_token;

      if (refreshToken) {
        // リフレッシュトークンでセッションを検索
        const session = await prisma.session.findUnique({
          where: { token: refreshToken },
        });

        if (session && !session.revokedAt && session.expiresAt > new Date()) {
          req.sessionId = session.id;

          // 認証済みリクエストの場合、最終活動時刻を更新（非同期で実行）
          if (req.user) {
            sessionService.updateSessionActivity(session.id).catch(() => {
              // エラーは無視（ログ出力のみ）
            });
          }
        }
      }

      next();
    } catch {
      // セッション追跡のエラーは無視して処理を継続
      next();
    }
  };
}

/**
 * リクエストからクライアント情報を抽出
 */
export function extractClientInfo(req: Request): { userAgent?: string; ipAddress?: string } {
  const userAgent = req.headers['user-agent'];
  // X-Forwarded-For ヘッダーまたは直接接続のIPを取得
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipAddress = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : req.socket.remoteAddress;

  return {
    userAgent: userAgent || undefined,
    ipAddress: ipAddress || undefined,
  };
}
