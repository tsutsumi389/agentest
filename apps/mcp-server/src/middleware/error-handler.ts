import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isAppError, ValidationError, AuthenticationError, AuthorizationError } from '@agentest/shared';
import { env } from '../config/env.js';

/**
 * JSON-RPCエラーコード
 */
const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // カスタムエラーコード（-32000 から -32099）
  AUTHENTICATION_ERROR: -32001,
  AUTHORIZATION_ERROR: -32002,
  VALIDATION_ERROR: -32003,
} as const;

/**
 * MCPエンドポイントへのリクエストかどうかを判定
 */
function isMcpRequest(req: Request): boolean {
  return req.path === '/mcp';
}

/**
 * JSON-RPC形式のエラーレスポンスを作成
 */
function createJsonRpcError(
  code: number,
  message: string,
  data?: unknown,
  id: string | number | null = null
) {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      ...(data !== undefined && { data }),
    },
    id,
  };
}

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
 *
 * MCPエンドポイント（/mcp）へのリクエストの場合はJSON-RPC形式で返す
 * それ以外はREST API形式で返す
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const useMcpFormat = isMcpRequest(req);

  // Zodエラーの場合はバリデーションエラーに変換
  if (error instanceof ZodError) {
    const validationError = handleZodError(error);
    if (useMcpFormat) {
      res.status(400).json(
        createJsonRpcError(
          JSON_RPC_ERROR_CODES.VALIDATION_ERROR,
          validationError.message,
          validationError.details
        )
      );
    } else {
      res.status(validationError.statusCode).json(validationError.toJSON());
    }
    return;
  }

  // AppErrorの場合は適切なレスポンスを返す
  if (isAppError(error)) {
    if (useMcpFormat) {
      let code: number = JSON_RPC_ERROR_CODES.INTERNAL_ERROR;
      if (error instanceof AuthenticationError) {
        code = JSON_RPC_ERROR_CODES.AUTHENTICATION_ERROR;
      } else if (error instanceof AuthorizationError) {
        code = JSON_RPC_ERROR_CODES.AUTHORIZATION_ERROR;
      } else if (error instanceof ValidationError) {
        code = JSON_RPC_ERROR_CODES.VALIDATION_ERROR;
      }
      res.status(error.statusCode).json(
        createJsonRpcError(code, error.message)
      );
    } else {
      res.status(error.statusCode).json(error.toJSON());
    }
    return;
  }

  // 予期しないエラーの場合
  console.error('予期しないエラー:', error);

  const statusCode = 500;
  const message = env.NODE_ENV === 'production'
    ? 'サーバー内部エラーが発生しました'
    : error.message;

  if (useMcpFormat) {
    res.status(statusCode).json(
      createJsonRpcError(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        message,
        env.NODE_ENV !== 'production' ? { stack: error.stack } : undefined
      )
    );
  } else {
    const response = {
      error: {
        code: 'INTERNAL_ERROR',
        message,
        statusCode,
        ...(env.NODE_ENV !== 'production' && { stack: error.stack }),
      },
    };
    res.status(statusCode).json(response);
  }
}
