import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BadRequestError,
  ConflictError,
  BusinessError,
  LockConflictError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,
  isAppError,
  isOperationalError,
  type LockHolder,
} from './index.js';

describe('AppError', () => {
  it('指定したステータスコード、コード、メッセージでエラーを生成できる', () => {
    const error = new AppError(400, 'TEST_ERROR', 'Test message');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test message');
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('isOperationalをfalseに設定できる', () => {
    const error = new AppError(500, 'CRITICAL', 'Critical error', false);

    expect(error.isOperational).toBe(false);
  });

  it('toJSON()で正しい形式のオブジェクトを返す', () => {
    const error = new AppError(400, 'TEST_ERROR', 'Test message');

    expect(error.toJSON()).toEqual({
      error: {
        code: 'TEST_ERROR',
        message: 'Test message',
        statusCode: 400,
      },
    });
  });
});

describe('ValidationError', () => {
  it('デフォルトで400ステータスとVALIDATION_ERRORコードを持つ', () => {
    const error = new ValidationError('Validation failed');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
    expect(error.details).toEqual({});
  });

  it('詳細なエラー情報を含められる', () => {
    const details = {
      email: ['無効なメールアドレスです'],
      name: ['名前は必須です', '名前は100文字以内です'],
    };
    const error = new ValidationError('入力内容に誤りがあります', details);

    expect(error.details).toEqual(details);
  });

  it('toJSON()で詳細情報も含める', () => {
    const details = { email: ['無効なメールアドレスです'] };
    const error = new ValidationError('入力エラー', details);

    expect(error.toJSON()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: '入力エラー',
        statusCode: 400,
        details,
      },
    });
  });
});

describe('AuthenticationError', () => {
  it('デフォルトメッセージで生成できる', () => {
    const error = new AuthenticationError();

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.message).toBe('Authentication required');
  });

  it('カスタムメッセージで生成できる', () => {
    const error = new AuthenticationError('Token expired');

    expect(error.message).toBe('Token expired');
  });
});

describe('AuthorizationError', () => {
  it('デフォルトメッセージで生成できる', () => {
    const error = new AuthorizationError();

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
    expect(error.message).toBe('Permission denied');
  });

  it('カスタムメッセージで生成できる', () => {
    const error = new AuthorizationError('Admin access required');

    expect(error.message).toBe('Admin access required');
  });
});

describe('NotFoundError', () => {
  it('リソース名のみで生成できる', () => {
    const error = new NotFoundError('User');

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('User not found');
  });

  it('リソース名とIDで生成できる', () => {
    const error = new NotFoundError('Project', 'abc-123');

    expect(error.message).toBe("Project with id 'abc-123' not found");
  });
});

describe('BadRequestError', () => {
  it('400ステータスでエラーを生成する', () => {
    const error = new BadRequestError('Invalid request');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid request');
  });
});

describe('ConflictError', () => {
  it('409ステータスでエラーを生成する', () => {
    const error = new ConflictError('Resource already exists');

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Resource already exists');
  });
});

describe('BusinessError', () => {
  it('カスタムコードとメッセージで生成できる', () => {
    const error = new BusinessError('LIMIT_EXCEEDED', 'プランの上限に達しました');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('LIMIT_EXCEEDED');
    expect(error.message).toBe('プランの上限に達しました');
  });
});

describe('LockConflictError', () => {
  it('ロック保持者情報を含んで生成できる', () => {
    const lockedBy: LockHolder = { type: 'user', id: 'user-123', name: '田中太郎' };
    const expiresAt = new Date('2024-01-01T12:00:00Z');
    const error = new LockConflictError(lockedBy, expiresAt);

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('LOCK_CONFLICT');
    expect(error.lockedBy).toEqual(lockedBy);
    expect(error.expiresAt).toEqual(expiresAt);
  });

  it('エージェントによるロックも表現できる', () => {
    const lockedBy: LockHolder = { type: 'agent', id: 'agent-456', name: 'Claude' };
    const expiresAt = new Date('2024-01-01T12:00:00Z');
    const error = new LockConflictError(lockedBy, expiresAt);

    expect(error.lockedBy.type).toBe('agent');
  });

  it('toJSON()でロック情報を含む', () => {
    const lockedBy: LockHolder = { type: 'user', id: 'user-123', name: '田中太郎' };
    const expiresAt = new Date('2024-01-01T12:00:00Z');
    const error = new LockConflictError(lockedBy, expiresAt);

    expect(error.toJSON()).toEqual({
      error: {
        code: 'LOCK_CONFLICT',
        message: 'Resource is already locked',
        statusCode: 409,
        lockedBy,
        expiresAt: '2024-01-01T12:00:00.000Z',
      },
    });
  });
});

describe('RateLimitError', () => {
  it('リトライまでの秒数を含んで生成できる', () => {
    const error = new RateLimitError(60);

    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.retryAfter).toBe(60);
  });
});

describe('InternalError', () => {
  it('デフォルトメッセージで生成できる', () => {
    const error = new InternalError();

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Internal server error');
    expect(error.isOperational).toBe(false);
  });

  it('カスタムメッセージで生成できる', () => {
    const error = new InternalError('Database connection failed');

    expect(error.message).toBe('Database connection failed');
  });
});

describe('ServiceUnavailableError', () => {
  it('デフォルトメッセージで生成できる', () => {
    const error = new ServiceUnavailableError();

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.message).toBe('Service temporarily unavailable');
  });

  it('カスタムメッセージで生成できる', () => {
    const error = new ServiceUnavailableError('メンテナンス中です');

    expect(error.message).toBe('メンテナンス中です');
  });
});

describe('isAppError', () => {
  it('AppErrorインスタンスに対してtrueを返す', () => {
    expect(isAppError(new AppError(400, 'TEST', 'test'))).toBe(true);
    expect(isAppError(new ValidationError('test'))).toBe(true);
    expect(isAppError(new AuthenticationError())).toBe(true);
    expect(isAppError(new NotFoundError('test'))).toBe(true);
  });

  it('通常のErrorに対してfalseを返す', () => {
    expect(isAppError(new Error('test'))).toBe(false);
  });

  it('nullやundefinedに対してfalseを返す', () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });

  it('オブジェクトや文字列に対してfalseを返す', () => {
    expect(isAppError({ code: 'TEST' })).toBe(false);
    expect(isAppError('error')).toBe(false);
  });
});

describe('isOperationalError', () => {
  it('操作可能なエラーに対してtrueを返す', () => {
    expect(isOperationalError(new ValidationError('test'))).toBe(true);
    expect(isOperationalError(new AuthenticationError())).toBe(true);
    expect(isOperationalError(new NotFoundError('test'))).toBe(true);
  });

  it('操作不可能なエラーに対してfalseを返す', () => {
    expect(isOperationalError(new InternalError())).toBe(false);
  });

  it('通常のErrorに対してfalseを返す', () => {
    expect(isOperationalError(new Error('test'))).toBe(false);
  });

  it('非エラー値に対してfalseを返す', () => {
    expect(isOperationalError(null)).toBe(false);
    expect(isOperationalError('error')).toBe(false);
  });
});
