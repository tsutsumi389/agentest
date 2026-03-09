import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiTokenService } from '../../services/api-token.service.js';

const router: Router = Router();
const apiTokenService = new ApiTokenService();

/**
 * APIトークン検証リクエストボディのスキーマ
 */
const validateApiTokenBodySchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /internal/api/api-token/validate
 * APIキーを検証（MCP内部通信用）
 */
router.post('/api-token/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ボディ検証
    const bodyResult = validateApiTokenBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { token } = bodyResult.data;

    // トークン検証
    const result = await apiTokenService.validateToken(token);

    res.json({
      valid: result.valid,
      userId: result.userId,
      organizationId: result.organizationId,
      scopes: result.scopes,
      tokenId: result.tokenId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
