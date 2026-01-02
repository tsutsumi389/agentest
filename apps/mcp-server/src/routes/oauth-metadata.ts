import { Router, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import { SUPPORTED_SCOPES } from '../middleware/oauth-auth.middleware.js';

const router: Router = Router();

/**
 * Protected Resource Metadata (RFC 9728)
 * GET /.well-known/oauth-protected-resource
 *
 * MCPサーバー（Resource Server）のメタデータを提供
 * クライアントはこのエンドポイントからAuthorization Serverの情報を取得
 */
router.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
  res.json({
    resource: env.MCP_SERVER_URL,
    authorization_servers: [env.AUTH_SERVER_URL],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ['header'],
  });
});

export default router;
