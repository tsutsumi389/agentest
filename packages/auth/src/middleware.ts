import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@agentest/db';
import { AuthenticationError, AuthorizationError } from '@agentest/shared';
import { verifyAccessToken } from './jwt.js';
import type { AuthConfig, JwtPayload } from './types.js';
import { defaultAuthConfig } from './config.js';

export interface AuthMiddlewareOptions {
  config?: AuthConfig;
  optional?: boolean;
}

/**
 * Extract token from Authorization header or cookie
 */
function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookieToken = req.cookies?.access_token;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export function authenticate(options: AuthMiddlewareOptions = {}) {
  const { config = defaultAuthConfig, optional = false } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      // Load user from database
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
 * Require authentication - stricter version that always requires a valid user
 */
export function requireAuth(config?: AuthConfig) {
  return authenticate({ config, optional: false });
}

/**
 * Optional authentication - continues even if no token is present
 */
export function optionalAuth(config?: AuthConfig) {
  return authenticate({ config, optional: true });
}

/**
 * Authorization middleware factory
 * Check if user has required role in organization
 */
export function requireOrgRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const orgId = req.params.organizationId || req.body?.organizationId;
      if (!orgId) {
        throw new AuthorizationError('Organization ID required');
      }

      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: req.user.id,
          },
        },
      });

      if (!member || !roles.includes(member.role)) {
        throw new AuthorizationError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Authorization middleware factory
 * Check if user has required role in project
 */
export function requireProjectRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated');
      }

      const projectId = req.params.projectId || req.body?.projectId;
      if (!projectId) {
        throw new AuthorizationError('Project ID required');
      }

      // Check if user is project owner
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          members: {
            where: { userId: req.user.id },
          },
        },
      });

      if (!project || project.deletedAt) {
        throw new AuthorizationError('Project not found');
      }

      // Owner has all permissions
      if (project.ownerId === req.user.id) {
        return next();
      }

      // Check project membership
      const member = project.members[0];
      if (!member || !roles.includes(member.role)) {
        // Check organization membership if project belongs to org
        if (project.organizationId) {
          const orgMember = await prisma.organizationMember.findUnique({
            where: {
              organizationId_userId: {
                organizationId: project.organizationId,
                userId: req.user.id,
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
