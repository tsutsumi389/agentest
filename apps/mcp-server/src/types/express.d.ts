import type { User } from '@prisma/client';
import type { JwtPayload } from '@agentest/auth';

declare global {
  namespace Express {
    interface Request {
      /** 認証されたユーザー */
      user?: User;
      /** JWTトークンペイロード */
      token?: JwtPayload;
      /** OAuth スコープ一覧 */
      oauthScopes?: string[];
    }
  }
}

export {};
