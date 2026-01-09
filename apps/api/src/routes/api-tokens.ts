import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '@agentest/auth';
import { ApiTokenService } from '../services/api-token.service.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const apiTokenService = new ApiTokenService();

/**
 * APIトークン作成リクエストボディのスキーマ
 */
const createTokenBodySchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内で入力してください'),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * APIトークン一覧を取得
 * GET /api/api-tokens
 */
router.get('/', requireAuth(authConfig), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const tokens = await apiTokenService.listTokens(userId);

    res.json({
      tokens: tokens.map((token) => ({
        id: token.id,
        name: token.name,
        tokenPrefix: token.tokenPrefix,
        scopes: token.scopes,
        expiresAt: token.expiresAt?.toISOString() ?? null,
        lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        revokedAt: token.revokedAt?.toISOString() ?? null,
        createdAt: token.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * APIトークンを作成
 * POST /api/api-tokens
 */
router.post('/', requireAuth(authConfig), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // リクエストボディ検証
    const parseResult = createTokenBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'リクエストが不正です',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { name, expiresInDays } = parseResult.data;
    const userId = req.user!.id;

    // 有効期限を計算
    let expiresAt: Date | undefined;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // トークンを作成
    const result = await apiTokenService.createToken({
      userId,
      name,
      expiresAt,
    });

    res.status(201).json({
      token: {
        id: result.id,
        name: result.name,
        tokenPrefix: result.tokenPrefix,
        rawToken: result.rawToken, // 生トークンは一度だけ返却
        scopes: result.scopes,
        expiresAt: result.expiresAt?.toISOString() ?? null,
        createdAt: result.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * APIトークンを失効
 * DELETE /api/api-tokens/:id
 */
router.delete('/:id', requireAuth(authConfig), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await apiTokenService.revokeToken(id, userId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
