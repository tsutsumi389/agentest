import type { Request, Response, NextFunction } from 'express';

/**
 * リクエストにIDを付与し、処理時間をログ出力するミドルウェア
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // リクエストIDを生成
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  // リクエスト開始時刻
  const startTime = Date.now();

  // レスポンス完了時にログ出力
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip,
    };

    // ステータスコードに応じてログレベルを変更
    if (res.statusCode >= 500) {
      console.error('リクエストエラー:', JSON.stringify(logData));
    } else if (res.statusCode >= 400) {
      console.warn('クライアントエラー:', JSON.stringify(logData));
    } else {
      console.log('リクエスト完了:', JSON.stringify(logData));
    }
  });

  next();
}
