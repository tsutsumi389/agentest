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
      /** 認証方式 */
      authType?: 'oauth' | 'api-key' | 'cookie';
    }
  }
}

export {};
