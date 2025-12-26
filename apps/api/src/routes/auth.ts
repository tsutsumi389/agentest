import { Router } from 'express';
import { passport, requireAuth, generateTokens } from '@agentest/auth';
import { prisma } from '@agentest/db';
import { AuthController } from '../controllers/auth.controller.js';
import { env } from '../config/env.js';

const router = Router();
const authController = new AuthController();

// 認証設定
const authConfig = {
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiry: env.JWT_REFRESH_EXPIRES_IN,
  },
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },
  oauth: {},
};

/**
 * 現在のユーザー情報を取得
 * GET /api/auth/me
 */
router.get('/me', requireAuth(authConfig), authController.me);

/**
 * トークンリフレッシュ
 * POST /api/auth/refresh
 */
router.post('/refresh', authController.refresh);

/**
 * ログアウト
 * POST /api/auth/logout
 */
router.post('/logout', requireAuth(authConfig), authController.logout);

/**
 * GitHub OAuth開始
 * GET /api/auth/github
 */
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  router.get('/github', passport.authenticate('github', { session: false, scope: ['user:email'] }));

  /**
   * GitHub OAuthコールバック
   * GET /api/auth/github/callback
   */
  router.get('/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: '/login?error=oauth_failed' }),
    authController.oauthCallback
  );
}

/**
 * Google OAuth開始
 * GET /api/auth/google
 */
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));

  /**
   * Google OAuthコールバック
   * GET /api/auth/google/callback
   */
  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }),
    authController.oauthCallback
  );
}

export default router;
