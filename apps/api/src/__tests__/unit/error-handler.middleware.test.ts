import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { type ZodError, z } from 'zod';
import multer from 'multer';
import {
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  ValidationError,
} from '@agentest/shared';

// envのモック
const mockEnv = vi.hoisted(() => ({
  NODE_ENV: 'development',
}));

vi.mock('../../config/env.js', () => ({
  env: mockEnv,
}));

// loggerのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// モック設定後にインポート
import { errorHandler } from '../../middleware/error-handler.js';

// リクエスト・レスポンスのモック作成
function createMockRequest(): Partial<Request> {
  return {};
}

function createMockResponse(): Partial<Response> & { _status?: number; _json?: unknown } {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res as Response;
  });
  res.json = vi.fn((data: unknown) => {
    res._json = data;
    return res as Response;
  });
  return res;
}

describe('errorHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response> & { _status?: number; _json?: unknown };
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = vi.fn();
    // デフォルトはdevelopment環境
    mockEnv.NODE_ENV = 'development';
  });

  describe('Multerエラー', () => {
    it('LIMIT_FILE_SIZEエラーを400に変換', () => {
      const error = new multer.MulterError('LIMIT_FILE_SIZE');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes._json).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'ファイルサイズが上限（100MB）を超えています',
          statusCode: 400,
        },
      });
    });

    it('その他のMulterErrorを400に変換', () => {
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes._json).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: expect.any(String),
          statusCode: 400,
        },
      });
    });

    it('ファイル形式エラーを400に変換', () => {
      const error = new Error('許可されていないファイル形式です');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes._json).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: '許可されていないファイル形式です',
          statusCode: 400,
        },
      });
    });
  });

  describe('ZodError', () => {
    it('ZodErrorをValidationErrorに変換', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
      });

      let zodError: ZodError | null = null;
      try {
        schema.parse({ name: '', email: 'invalid' });
      } catch (e) {
        zodError = e as ZodError;
      }

      errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes._json).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力値が不正です',
          statusCode: 400,
          details: expect.any(Object),
        },
      });
    });

    it('パス情報を含むdetailsを返す', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().min(1, 'Name is required'),
        }),
      });

      let zodError: ZodError | null = null;
      try {
        schema.parse({ user: { name: '' } });
      } catch (e) {
        zodError = e as ZodError;
      }

      errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

      const responseJson = mockRes._json as { error: { details: Record<string, string[]> } };
      expect(responseJson.error.details).toHaveProperty('user.name');
    });
  });

  describe('AppError', () => {
    it('NotFoundErrorを404で返す', () => {
      const error = new NotFoundError('User');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes._json).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
          statusCode: 404,
        },
      });
    });

    it('AuthenticationErrorを401で返す', () => {
      const error = new AuthenticationError('Not authenticated');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes._json).toMatchObject({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Not authenticated',
          statusCode: 401,
        },
      });
    });

    it('AuthorizationErrorを403で返す', () => {
      const error = new AuthorizationError('Not authorized');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes._json).toMatchObject({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Not authorized',
          statusCode: 403,
        },
      });
    });

    it('BadRequestErrorを400で返す', () => {
      const error = new BadRequestError('Invalid request');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes._json).toMatchObject({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid request',
          statusCode: 400,
        },
      });
    });

    it('ValidationErrorを400で返す', () => {
      const error = new ValidationError('Validation failed', { field: ['error message'] });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes._json).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          statusCode: 400,
          details: { field: ['error message'] },
        },
      });
    });
  });

  describe('予期しないエラー', () => {
    it('500ステータスを返す', () => {
      const error = new Error('Unexpected error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('development環境ではエラーメッセージとスタックトレースを含める', () => {
      mockEnv.NODE_ENV = 'development';
      const error = new Error('Unexpected error');
      error.stack = 'Error: Unexpected error\n    at test';

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes._json).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected error',
          statusCode: 500,
          stack: expect.stringContaining('Unexpected error'),
        },
      });
    });

    it('production環境ではスタックトレースを含めない', () => {
      mockEnv.NODE_ENV = 'production';
      const error = new Error('Unexpected error');
      error.stack = 'Error: Unexpected error\n    at test';

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes._json).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
          statusCode: 500,
        },
      });
      expect((mockRes._json as { error: { stack?: string } }).error.stack).toBeUndefined();
    });

    it('production環境では詳細なエラーメッセージを隠す', () => {
      mockEnv.NODE_ENV = 'production';
      const error = new Error('Database connection failed: password incorrect');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes._json).toMatchObject({
        error: {
          message: 'サーバー内部エラーが発生しました',
        },
      });
    });

    it('loggerでエラーをログ出力', () => {
      const error = new Error('Unexpected error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: error }),
        '予期しないエラー'
      );
    });
  });

  describe('test環境', () => {
    it('test環境はdevelopmentと同様に詳細を表示', () => {
      mockEnv.NODE_ENV = 'test';
      const error = new Error('Test error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes._json).toMatchObject({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Test error',
          statusCode: 500,
        },
      });
    });
  });
});
