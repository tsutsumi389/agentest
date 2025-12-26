import { Router } from 'express';
import { passport, requireAuth, optionalAuth } from '@agentest/auth';
import { AuthController } from '../controllers/auth.controller.js';
import { authConfig } from '../config/auth.js';
import { env } from '../config/env.js';

const router: Router = Router();
const authController = new AuthController();

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

  /**
   * GitHub連携追加開始（ログイン済みユーザー用）
   * GET /api/auth/github/link
   */
  router.get('/github/link',
    requireAuth(authConfig),
    passport.authenticate('github-link', { session: false, scope: ['user:email'] })
  );

  /**
   * GitHub連携追加コールバック
   * GET /api/auth/github/link/callback
   */
  router.get('/github/link/callback',
    optionalAuth(authConfig),
    passport.authenticate('github-link', { session: false, failureRedirect: '/settings?tab=security&link=error' }),
    authController.oauthLinkCallback
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

  /**
   * Google連携追加開始（ログイン済みユーザー用）
   * GET /api/auth/google/link
   */
  router.get('/google/link',
    requireAuth(authConfig),
    passport.authenticate('google-link', { session: false, scope: ['profile', 'email'] })
  );

  /**
   * Google連携追加コールバック
   * GET /api/auth/google/link/callback
   */
  router.get('/google/link/callback',
    optionalAuth(authConfig),
    passport.authenticate('google-link', { session: false, failureRedirect: '/settings?tab=security&link=error' }),
    authController.oauthLinkCallback
  );
}

export default router;
