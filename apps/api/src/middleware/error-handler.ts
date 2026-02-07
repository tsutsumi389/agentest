import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { isAppError, ValidationError } from '@agentest/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

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
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Multerエラーの場合
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'ファイルサイズが上限（100MB）を超えています',
          statusCode: 400,
        },
      });
      return;
    }
    // その他のMulterError
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: error.message,
        statusCode: 400,
      },
    });
    return;
  }

  // fileFilterからのエラー（通常のErrorとして投げられる）
  if (error.message === '許可されていないファイル形式です') {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: error.message,
        statusCode: 400,
      },
    });
    return;
  }

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
  logger.error({ err: error, requestId: req.requestId }, '予期しないエラー');

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
