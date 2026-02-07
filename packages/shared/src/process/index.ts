/**
 * プロセスレベルの例外ハンドラ
 *
 * uncaughtException / unhandledRejection をキャッチし、
 * 構造化ログ出力後にgraceful shutdownを実行する。
 */

/** シャットダウン関数の型 */
export type ShutdownFn = (signal: string, exitCode?: number) => Promise<void>;

/** セーフティネットのデフォルトタイムアウト（ミリ秒）。各アプリのgraceful shutdownタイムアウト（10秒）と統一。 */
const DEFAULT_SAFETY_TIMEOUT_MS = 10_000;

export interface ProcessHandlersOptions {
  /**
   * 致命的エラー発生時のシャットダウン関数を返す。
   * サーバー起動前など、まだシャットダウン関数が未定義の場合はnullを返す。
   * nullの場合は即座にprocess.exit(1)する。
   */
  getShutdownFn: () => ShutdownFn | null;
  /** セーフティネットの強制終了タイムアウト（ミリ秒）。デフォルト: 10000 */
  safetyTimeoutMs?: number;
}

/**
 * プロセスレベルの例外ハンドラを登録する。
 * モジュールのトップレベルで呼び出すことで、起動中の例外もキャッチできる。
 */
export function registerProcessHandlers(options: ProcessHandlersOptions): void {
  const { safetyTimeoutMs = DEFAULT_SAFETY_TIMEOUT_MS } = options;

  process.on('uncaughtException', (error: Error) => {
    logUncaughtException(error);
    triggerShutdown(options.getShutdownFn(), 'uncaughtException', safetyTimeoutMs);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logUnhandledRejection(reason);
    triggerShutdown(options.getShutdownFn(), 'unhandledRejection', safetyTimeoutMs);
  });
}

/**
 * uncaughtException のログ出力（テスト用にエクスポート）
 */
export function logUncaughtException(error: Error): void {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: 'キャッチされない例外が発生しました',
    error: error.message,
    stack: error.stack,
  }));
}

/**
 * unhandledRejection のログ出力（テスト用にエクスポート）
 */
export function logUnhandledRejection(reason: unknown): void {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: '未処理のPromise拒否が発生しました',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  }));
}

/**
 * シャットダウンを起動し、セーフティネットタイムアウトを設定する（テスト用にエクスポート）
 */
export function triggerShutdown(
  shutdownFn: ShutdownFn | null,
  signal: string,
  safetyTimeoutMs: number,
): void {
  if (shutdownFn) {
    shutdownFn(signal, 1).catch(() => {});
  } else {
    process.exit(1);
  }
  // シャットダウンがハングまたはスキップされた場合のセーフティネット
  setTimeout(() => process.exit(1), safetyTimeoutMs).unref();
}
