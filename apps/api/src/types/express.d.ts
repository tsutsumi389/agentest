import type { User } from '@prisma/client';
import type { JwtPayload } from '@agentest/auth';

declare global {
  namespace Express {
    interface Request {
      /** リクエストID（ログ追跡用） */
      requestId?: string;
      /** 認証されたユーザー */
      user?: User;
      /** JWTトークンペイロード */
      token?: JwtPayload;
      /** 現在のセッションID */
      sessionId?: string;
      /** 管理者ユーザー情報 */
      adminUser?: {
        id: string;
        email: string;
        name: string;
        role: string;
        totpEnabled: boolean;
      };
      /** 管理者セッション情報 */
      adminSession?: {
        id: string;
        token: string;
        createdAt: Date;
        expiresAt: Date;
      };
    }
  }
}

export {};
