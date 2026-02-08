import { Router } from 'express';
import { oauthController } from '../controllers/oauth.controller.js';
import { authenticate } from '@agentest/auth';
import { requireInternalApiAuth } from '../middleware/internal-api.middleware.js';
import { csrfProtection } from '../middleware/csrf.middleware.js';

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
router.post('/register', oauthController.register);

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
// 認証必須 + CSRF保護（フロントエンドからのPOSTリクエスト）
router.post('/authorize/consent', csrfProtection(), authenticate(), oauthController.consent);

// ============================================
// トークンエンドポイント
// POST /oauth/token
// ============================================
router.post('/token', oauthController.token);

// ============================================
// トークンイントロスペクション (RFC 7662)
// POST /oauth/introspect
// 内部API用 (MCPサーバーから呼び出し、INTERNAL_API_SECRETで認証)
// ============================================
router.post('/introspect', requireInternalApiAuth(), oauthController.introspect);

// ============================================
// トークン失効 (RFC 7009)
// POST /oauth/revoke
// ============================================
router.post('/revoke', oauthController.revoke);

export default router;
