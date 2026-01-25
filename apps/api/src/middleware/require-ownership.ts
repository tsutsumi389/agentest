/**
 * リソースオーナーシップ認可ミドルウェア
 *
 * リクエストパラメータのuserIdが認証ユーザーと一致することを検証する。
 * 自分自身のリソースに対する操作のみを許可。
 */

import type { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '@agentest/shared';

/**
 * オーナーシップチェックミドルウェア
 *
 * req.params.userId が req.user.id と一致することを検証。
 * 一致しない場合は AuthorizationError をスロー。
 *
 * @param paramName - チェック対象のパラメータ名（デフォルト: 'userId'）
 */
export function requireOwnership(paramName = 'userId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const resourceUserId = req.params[paramName];
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      return next(new AuthorizationError('認証が必要です'));
    }

    if (resourceUserId !== currentUserId) {
      return next(new AuthorizationError('このリソースにアクセスする権限がありません'));
    }

    return next();
  };
}
