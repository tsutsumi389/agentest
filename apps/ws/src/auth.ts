import { verifyAccessToken, defaultAuthConfig } from '@agentest/auth';
import { prisma } from '@agentest/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * JWTトークンを検証してユーザー情報を取得
 */
export async function authenticateToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    const payload = verifyAccessToken(token, defaultAuthConfig);

    // データベースからユーザーを取得
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  } catch {
    return null;
  }
}

