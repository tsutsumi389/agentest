import { Router } from 'express';
import { oauthController } from '../controllers/oauth.controller.js';
import { authenticate } from '@agentest/auth';
import { authLimiter } from '../middleware/rate-limiter.js';

const router: Router = Router();

// ============================================
// Authorization Server Metadata
// ============================================

// GET /.well-known/oauth-authorization-server
// このルートはルートレベルで定義する必要がある (index.tsで設定)

// ============================================
// 動的クライアント登録 (RFC 7591)
// POST /oauth/register
// ============================================
router.post('/register', authLimiter, oauthController.register);

// ============================================
// 認可エンドポイント
// GET /oauth/authorize
// ============================================
// 認証は任意 (未認証ならログインページへリダイレクト)
router.get('/authorize', authenticate({ optional: true }), oauthController.authorize);

// ============================================
// 同意承認エンドポイント
// POST /oauth/authorize/consent
// ============================================
// 認証必須
router.post('/authorize/consent', authenticate(), oauthController.consent);

// ============================================
// トークンエンドポイント
// POST /oauth/token
// ============================================
router.post('/token', authLimiter, oauthController.token);

// ============================================
// トークンイントロスペクション (RFC 7662)
// POST /oauth/introspect
// 内部API用 (MCPサーバーから呼び出し)
// ============================================
router.post('/introspect', oauthController.introspect);

// ============================================
// トークン失効 (RFC 7009)
// POST /oauth/revoke
// ============================================
router.post('/revoke', oauthController.revoke);

export default router;
