import { Router } from 'express';
import { passport, requireAuth, generateTokens } from '@agentest/auth';
import { prisma } from '@agentest/db';
import { AuthController } from '../controllers/auth.controller.js';
import { UserTotpController } from '../controllers/user-totp.controller.js';
import { authConfig, SESSION_EXPIRY_MS, LINK_MODE_COOKIE } from '../config/auth.js';
import { env } from '../config/env.js';
import { extractClientInfo } from '../middleware/session.middleware.js';
import { hashToken } from '../utils/pkce.js';
import { rateLimiter } from '../middleware/rate-limiter.js';

const router: Router = Router();
const authController = new AuthController();
const userTotpController = new UserTotpController();
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
 * メール/パスワードログイン
 * POST /api/auth/login
 */
router.post('/login', authController.login);

/**
 * メール/パスワード新規登録
 * POST /api/auth/register
 */
router.post('/register', authController.register);

/**
 * メールアドレス確認
 * GET /api/auth/verify-email?token=xxx
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * メールアドレス確認メール再送信
 * POST /api/auth/resend-verification
 */
router.post('/resend-verification', authController.resendVerification);

/**
 * パスワードリセット要求
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * パスワードリセット実行
 * POST /api/auth/reset-password
 */
router.post('/reset-password', authController.resetPassword);

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
  router.get(
    '/github/callback',
    passport.authenticate('github', {
      session: false,
      failureRedirect: '/login?error=oauth_failed',
    }),
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
    res.cookie(
      LINK_MODE_COOKIE,
      JSON.stringify({
        provider: 'github',
        userId: req.user!.id,
      }),
      linkCookieOptions
    );
    // 通常のOAuth開始エンドポイントにリダイレクト
    res.redirect('/api/auth/github');
  });
}

/**
 * Google OAuth開始
 * GET /api/auth/google
 */
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  router.get(
    '/google',
    passport.authenticate('google', { session: false, scope: ['profile', 'email'] })
  );

  /**
   * Google OAuthコールバック
   * GET /api/auth/google/callback
   */
  router.get(
    '/google/callback',
    passport.authenticate('google', {
      session: false,
      failureRedirect: '/login?error=oauth_failed',
    }),
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
    res.cookie(
      LINK_MODE_COOKIE,
      JSON.stringify({
        provider: 'google',
        userId: req.user!.id,
      }),
      linkCookieOptions
    );
    // 通常のOAuth開始エンドポイントにリダイレクト
    res.redirect('/api/auth/google');
  });
}

// ==================== 2FA (TOTP) エンドポイント ====================

/**
 * 2FAステータス取得
 * GET /api/auth/2fa/status
 */
router.get('/2fa/status', requireAuth(authConfig), userTotpController.status);

/**
 * 2FAセットアップ開始
 * POST /api/auth/2fa/setup
 *
 * QRコードと秘密鍵を返却（レート制限: 3回/分）
 */
router.post(
  '/2fa/setup',
  requireAuth(authConfig),
  rateLimiter({ max: 3, windowMs: 60000, routeId: '2fa-setup' }),
  userTotpController.setup
);

/**
 * 2FA有効化
 * POST /api/auth/2fa/enable
 *
 * TOTPコードを検証し有効化（レート制限: 5回/分）
 */
router.post(
  '/2fa/enable',
  requireAuth(authConfig),
  rateLimiter({ max: 5, windowMs: 60000, routeId: '2fa-enable' }),
  userTotpController.enable
);

/**
 * 2FA検証（ログイン時の第2ステップ）
 * POST /api/auth/2fa/verify
 *
 * JWT未発行状態で呼ばれるため、requireAuth不要。
 * twoFactorTokenで認証する（AuthControllerが処理）。
 * レート制限: 5回/分（ブルートフォース対策）
 */
router.post(
  '/2fa/verify',
  rateLimiter({ max: 5, windowMs: 60000, routeId: '2fa-verify' }),
  authController.verifyTwoFactor
);

/**
 * 2FA無効化
 * POST /api/auth/2fa/disable
 *
 * パスワード確認後に無効化（レート制限: 5回/分）
 */
router.post(
  '/2fa/disable',
  requireAuth(authConfig),
  rateLimiter({ max: 5, windowMs: 60000, routeId: '2fa-disable' }),
  userTotpController.disable
);

// テスト用ログインエンドポイント（非本番環境のみ）
if (env.NODE_ENV !== 'production') {
  // テスト環境用のクッキー設定（secure: false）
  const testCookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: 'strict' as const,
    path: '/',
  };

  router.post('/test-login', async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: 'メールアドレスが必要です' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(404).json({ error: 'ユーザーが見つかりません' });
        return;
      }

      // トークン生成
      const tokens = generateTokens(user.id, user.email, authConfig);

      // クライアント情報を抽出
      const clientInfo = extractClientInfo(req);

      // リフレッシュトークンとセッションを保存（トランザクションでアトミックに実行）
      const tokenHash = hashToken(tokens.refreshToken);
      await prisma.$transaction(async (tx) => {
        await Promise.all([
          tx.refreshToken.create({
            data: {
              userId: user.id,
              tokenHash,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
          tx.session.create({
            data: {
              userId: user.id,
              tokenHash,
              userAgent: clientInfo.userAgent,
              ipAddress: clientInfo.ipAddress,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
        ]);
      });

      // クッキーに設定
      res.cookie('access_token', tokens.accessToken, {
        ...testCookieOptions,
        maxAge: 15 * 60 * 1000, // 15分
      });
      res.cookie('refresh_token', tokens.refreshToken, {
        ...testCookieOptions,
        maxAge: SESSION_EXPIRY_MS,
      });

      res.json({ user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      next(error);
    }
  });
}

export default router;
