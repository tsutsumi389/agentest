import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requestLogger } from '../../middleware/request-logger.js';

// crypto.randomUUIDのモック
const mockUUID = '12345678-1234-1234-1234-123456789abc';
vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID);

describe('requestLogger', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let finishCallback: (() => void) | undefined;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // console出力のモック
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // リクエストモック
    mockReq = {
      method: 'GET',
      originalUrl: '/api/users',
      get: vi.fn((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0';
        return undefined;
      }),
      ip: '192.168.1.1',
    };

    // レスポンスモック
    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      on: vi.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
        return mockRes;
      }),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('リクエストID', () => {
    it('リクエストにrequestIdを付与する', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.requestId).toBe(mockUUID);
    });

    it('X-Request-IDヘッダーを設定する', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', mockUUID);
    });
  });

  describe('ミドルウェア動作', () => {
    it('nextを呼び出す', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('finishイベントをリッスンする', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });

  describe('レスポンスログ', () => {
    it('レスポンス完了時にログを出力する', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      // finishイベントを発火
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('200番台のステータスはconsole.logで出力', () => {
      mockRes.statusCode = 200;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'リクエスト完了:',
        expect.stringContaining('"statusCode":200')
      );
    });

    it('300番台のステータスはconsole.logで出力', () => {
      mockRes.statusCode = 301;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'リクエスト完了:',
        expect.stringContaining('"statusCode":301')
      );
    });

    it('400番台のステータスはconsole.warnで出力', () => {
      mockRes.statusCode = 404;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'クライアントエラー:',
        expect.stringContaining('"statusCode":404')
      );
    });

    it('401エラーはconsole.warnで出力', () => {
      mockRes.statusCode = 401;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('500番台のステータスはconsole.errorで出力', () => {
      mockRes.statusCode = 500;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'リクエストエラー:',
        expect.stringContaining('"statusCode":500')
      );
    });

    it('503エラーはconsole.errorで出力', () => {
      mockRes.statusCode = 503;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('ログ内容', () => {
    it('requestIdを含む', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(`"requestId":"${mockUUID}"`)
      );
    });

    it('methodを含む', () => {
      mockReq.method = 'POST';
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"method":"POST"')
      );
    });

    it('urlを含む', () => {
      mockReq.originalUrl = '/api/test/endpoint';
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"url":"/api/test/endpoint"')
      );
    });

    it('statusCodeを含む', () => {
      mockRes.statusCode = 201;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"statusCode":201')
      );
    });

    it('durationを含む', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/"duration":"\d+ms"/)
      );
    });

    it('userAgentを含む', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"userAgent":"Mozilla/5.0"')
      );
    });

    it('ipを含む', () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"ip":"192.168.1.1"')
      );
    });
  });

  describe('様々なHTTPメソッド', () => {
    it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])('%sメソッドを正しくログ出力', (method) => {
      mockReq.method = method;
      requestLogger(mockReq as Request, mockRes as Response, mockNext);
      finishCallback?.();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(`"method":"${method}"`)
      );
    });
  });
});
