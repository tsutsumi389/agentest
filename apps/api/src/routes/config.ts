import { Router } from 'express';
import { env } from '../config/env.js';

const router: Router = Router();

/**
 * GET /api/config
 * 公開設定API（認証不要）
 * フロントエンドに利用可能な機能の設定情報を返す
 */
router.get('/', (_req, res) => {
  res.json({
    auth: {
      providers: {
        github: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
        google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      },
      requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    },
  });
});

export default router;
