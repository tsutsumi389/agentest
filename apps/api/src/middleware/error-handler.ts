import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isAppError, ValidationError } from '@agentest/shared';
import { env } from '../config/env.js';

/**
 * Zodエラーをバリデーションエラーに変換
 */
function handleZodError(error: ZodError): ValidationError {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return new ValidationError('入力値が不正です', details);
}

/**
 * グローバルエラーハンドラーミドルウェア
 */
export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zodエラーの場合はバリデーションエラーに変換
  if (error instanceof ZodError) {
    const validationError = handleZodError(error);
    res.status(validationError.statusCode).json(validationError.toJSON());
    return;
  }

  // AppErrorの場合は適切なレスポンスを返す
  if (isAppError(error)) {
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  // 予期しないエラーの場合
  console.error('予期しないエラー:', error);

  const statusCode = 500;
  const response = {
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production'
        ? 'サーバー内部エラーが発生しました'
        : error.message,
      statusCode,
      ...(env.NODE_ENV !== 'production' && { stack: error.stack }),
    },
  };

  res.status(statusCode).json(response);
}
