// Types
export type {
  JwtPayload,
  TokenPair,
  AuthConfig,
  OAuthProfile,
} from './types.js';

// Config
export { createAuthConfig, defaultAuthConfig } from './config.js';

// JWT utilities
export {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  getTokenExpiry,
} from './jwt.js';

// Passport
export { configurePassport, passport } from './passport.js';
export type { OAuthCallback, OAuthCallbackResult } from './passport.js';

// Middleware
export {
  authenticate,
  requireAuth,
  optionalAuth,
  requireOrgRole,
  requireProjectRole,
} from './middleware.js';
export type { AuthMiddlewareOptions } from './middleware.js';
