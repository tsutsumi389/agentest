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
    }
  }
}

export {};
