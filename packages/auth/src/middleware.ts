import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@agentest/db';
import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { verifyAccessToken } from './jwt.js';
import type { AuthConfig } from './types.js';
import { defaultAuthConfig } from './config.js';

export interface AuthMiddlewareOptions {
  config?: AuthConfig;
  optional?: boolean;
}

/**
 * Authorizationヘッダーまたはクッキーからトークンを抽出
 */
function extractToken(req: Request): string | null {
  // Authorizationヘッダーをチェック
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // クッキーをチェック
  const cookieToken = req.cookies?.access_token;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * 認証ミドルウェア
 * JWTトークンを検証し、リクエストにユーザーを添付
 */
export function authenticate(options: AuthMiddlewareOptions = {}) {
  const { config = defaultAuthConfig, optional = false } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractToken(req);

      if (!token) {
        if (optional) {
          return next();
        }
        throw new AuthenticationError('No authentication token provided');
      }

      const payload = verifyAccessToken(token, config);
      req.token = payload;

      // データベースからユーザーを取得
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.deletedAt) {
        throw new AuthenticationError('User not found');
      }

      req.user = user;
      next();
    } catch (error) {
      if (optional && error instanceof AuthenticationError) {
        return next();
      }
      next(error);
    }
  };
}

/**
 * 認証必須 - 常に有効なユーザーを要求する厳格版
 */
export function requireAuth(config?: AuthConfig) {
  return authenticate({ config, optional: false });
}

/**
 * 認証任意 - トークンがなくても処理を継続
 */
export function optionalAuth(config?: AuthConfig) {
  return authenticate({ config, optional: true });
}

export interface RequireOrgRoleOptions {
  /**
   * 削除済み組織への操作を許可するか（デフォルト: false）
   * trueの場合、deletedAtがnullでない組織でも権限チェックを通過する
   */
  allowDeletedOrg?: boolean;
}

/**
 * 認可ミドルウェアファクトリ
 * ユーザーが組織内で必要なロールを持っているかチェック
 */
export function requireOrgRole(roles: string[], options: RequireOrgRoleOptions = {}) {
  const { allowDeletedOrg = false } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const orgId = req.params.organizationId || req.body?.organizationId;
      if (!orgId) {
        throw new AuthorizationError('Organization ID required');
      }

      const user = req.user as { id: string };

      // メンバーシップと組織情報を同時に取得
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: user.id,
          },
        },
        include: {
          organization: {
            select: { deletedAt: true },
          },
        },
      });

      if (!member || !roles.includes(member.role)) {
        throw new AuthorizationError('Insufficient permissions');
      }

      // 削除済み組織のチェック
      if (member.organization.deletedAt && !allowDeletedOrg) {
        throw new AuthorizationError('Organization has been deleted');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export interface RequireProjectRoleOptions {
  /**
   * 削除済みプロジェクトへの操作を許可するか（デフォルト: false）
   * trueの場合、deletedAtがnullでないプロジェクトでも権限チェックを通過する
   */
  allowDeletedProject?: boolean;
}

/**
 * 認可ミドルウェアファクトリ
 * ユーザーがプロジェクト内で必要なロールを持っているかチェック
 */
export function requireProjectRole(roles: string[], options: RequireProjectRoleOptions = {}) {
  const { allowDeletedProject = false } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const user = req.user as { id: string };
      const projectId = req.params.projectId || req.body?.projectId;
      if (!projectId) {
        throw new AuthorizationError('Project ID required');
      }

      // ユーザーがプロジェクトオーナーかチェック
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          members: {
            where: { userId: user.id },
          },
        },
      });

      if (!project) {
        throw new AuthorizationError('Project not found');
      }

      // 削除済みプロジェクトのチェック
      if (project.deletedAt && !allowDeletedProject) {
        throw new AuthorizationError('Project has been deleted');
      }

      // オーナーは全権限を持つ
      if (project.ownerId === user.id) {
        return next();
      }

      // プロジェクトメンバーシップをチェック
      const member = project.members[0];
      if (!member || !roles.includes(member.role)) {
        // プロジェクトが組織に属する場合、組織メンバーシップをチェック
        if (project.organizationId) {
          const orgMember = await prisma.organizationMember.findUnique({
            where: {
              organizationId_userId: {
                organizationId: project.organizationId,
                userId: user.id,
              },
            },
          });

          if (orgMember && ['OWNER', 'ADMIN'].includes(orgMember.role)) {
            return next();
          }
        }

        throw new AuthorizationError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
