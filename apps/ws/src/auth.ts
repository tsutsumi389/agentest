import { verifyAccessToken, defaultAuthConfig } from '@agentest/auth';
import { prisma } from '@agentest/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Cookieヘッダーからaccess_tokenを抽出
 */
export function parseCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === 'access_token') {
      const value = rest.join('=');
      return value || null;
    }
  }

  return null;
}

/**
 * Cookieヘッダーからトークンを抽出して認証
 */
export async function authenticateFromCookie(cookieHeader: string | undefined): Promise<AuthenticatedUser | null> {
  const token = parseCookieToken(cookieHeader);
  if (!token) return null;
  return authenticateToken(token);
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

