/**
 * シンプルなロガーユーティリティ
 * 将来的にPino等のロギングライブラリに置き換え可能
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

/**
 * ログ出力関数
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    level,
    message,
    ...context,
  };

  switch (level) {
    case 'error':
      console.error(JSON.stringify(logData));
      break;
    case 'warn':
      console.warn(JSON.stringify(logData));
      break;
    case 'debug':
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug(JSON.stringify(logData));
      }
      break;
    case 'info':
    default:
      console.info(JSON.stringify(logData));
      break;
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
  debug: (message: string, context?: LogContext) => log('debug', message, context),
};
