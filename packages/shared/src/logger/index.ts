/**
 * 構造化ログモジュール（Pino）
 *
 * 各バックエンドアプリで使用するサービス別ロガーを生成する。
 * - JSON構造化ログ出力（stdout）
 * - ログレベル制御（環境変数 / オプション）
 * - ISO 8601タイムスタンプ
 * - child logger によるコンテキスト伝搬
 */

import pino from 'pino';
import type { DestinationStream } from 'pino';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

/** ランタイムバリデーション用の有効なログレベル一覧 */
const VALID_LOG_LEVELS: ReadonlySet<string> = new Set<LogLevel>([
  'fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent',
]);

export type Logger = pino.Logger;

export interface CreateLoggerOptions {
  service: string;
  level?: LogLevel;
}

/**
 * 環境に基づくデフォルトログレベルを返す
 * - LOG_LEVEL 環境変数が設定されていればそれを使用（バリデーション付き）
 * - NODE_ENV に基づいて自動判定（production: info, development: debug, test: silent）
 */
function resolveLogLevel(explicitLevel?: LogLevel): LogLevel {
  if (explicitLevel) return explicitLevel;

  const envLevel = process.env.LOG_LEVEL;
  if (envLevel && VALID_LOG_LEVELS.has(envLevel)) {
    return envLevel as LogLevel;
  }

  switch (process.env.NODE_ENV) {
    case 'production':
      return 'info';
    case 'test':
      return 'silent';
    default:
      return 'debug';
  }
}

/**
 * サービス別のPinoロガーを生成する
 *
 * @param options - サービス名やログレベルの設定
 * @param destination - 出力先ストリーム（テスト用。省略時はstdout）
 */
export function createLogger(options: CreateLoggerOptions, destination?: DestinationStream): Logger {
  const level = resolveLogLevel(options.level);

  const loggerOptions: pino.LoggerOptions = {
    level,
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    base: {
      service: options.service,
      env: process.env.NODE_ENV,
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  // 開発時の可読フォーマット（destination指定時はtransportを使わない）
  if (process.env.LOG_PRETTY === 'true' && !destination) {
    loggerOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    };
  }

  if (destination) {
    return pino(loggerOptions, destination);
  }

  return pino(loggerOptions);
}
