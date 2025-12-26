import { Router } from 'express';
import { passport, requireAuth } from '@agentest/auth';
import { AuthController } from '../controllers/auth.controller.js';
import { authConfig } from '../config/auth.js';
import { env } from '../config/env.js';

const router: Router = Router();
const authController = new AuthController();

// OAuth連携追加モードを示すクッキー設定
const LINK_MODE_COOKIE = 'oauth_link_mode';
const linkCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // OAuthリダイレクトで必要
  path: '/',
  maxAge: 5 * 60 * 1000, // 5分間有効
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

  /**
   * GitHub連携追加開始（ログイン済みユーザー用）
   * GET /api/auth/github/link
   *
   * クッキーに連携追加モードを設定し、通常のOAuthフローにリダイレクト
   */
  router.get('/github/link', requireAuth(authConfig), (req, res) => {
    // 連携追加モードをクッキーに設定（ユーザーIDを含む）
    res.cookie(LINK_MODE_COOKIE, JSON.stringify({
      provider: 'github',
      userId: req.user!.id,
    }), linkCookieOptions);
    // 通常のOAuth開始エンドポイントにリダイレクト
    res.redirect('/api/auth/github');
  });
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
   *
   * クッキーに連携追加モードを設定し、通常のOAuthフローにリダイレクト
   */
  router.get('/google/link', requireAuth(authConfig), (req, res) => {
    // 連携追加モードをクッキーに設定（ユーザーIDを含む）
    res.cookie(LINK_MODE_COOKIE, JSON.stringify({
      provider: 'google',
      userId: req.user!.id,
    }), linkCookieOptions);
    // 通常のOAuth開始エンドポイントにリダイレクト
    res.redirect('/api/auth/google');
  });
}

export default router;
