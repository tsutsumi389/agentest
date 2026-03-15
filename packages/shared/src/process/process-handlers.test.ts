import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logUncaughtException,
  logUnhandledRejection,
  triggerShutdown,
  registerProcessHandlers,
  type ShutdownFn,
  type ProcessLogger,
} from './index.js';

describe('logUncaughtException', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('loggerが提供された場合、logger.fatalを使用する', () => {
    const mockLogger: ProcessLogger = { fatal: vi.fn() };
    const error = new Error('テストエラー');

    logUncaughtException(error, mockLogger);

    expect(mockLogger.fatal).toHaveBeenCalledWith(
      { err: error },
      'キャッチされない例外が発生しました'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('構造化JSON形式でエラーログを出力する', () => {
    const error = new Error('テストエラー');
    error.stack = 'Error: テストエラー\n    at test.ts:1:1';

    logUncaughtException(error);

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logOutput).toMatchObject({
      level: 'fatal',
      msg: 'キャッチされない例外が発生しました',
      error: 'テストエラー',
      stack: 'Error: テストエラー\n    at test.ts:1:1',
    });
    expect(logOutput.time).toBeDefined();
  });

  it('timeがISO 8601形式である', () => {
    logUncaughtException(new Error('test'));

    const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(() => new Date(logOutput.time)).not.toThrow();
    expect(new Date(logOutput.time).toISOString()).toBe(logOutput.time);
  });
});

describe('logUnhandledRejection', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('Errorオブジェクトの場合、message/stackを出力する', () => {
    const error = new Error('Promise拒否');
    error.stack = 'Error: Promise拒否\n    at test.ts:2:2';

    logUnhandledRejection(error);

    const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logOutput).toMatchObject({
      level: 'fatal',
      msg: '未処理のPromise拒否が発生しました',
      reason: 'Promise拒否',
      stack: 'Error: Promise拒否\n    at test.ts:2:2',
    });
  });

  it('文字列の場合、reasonにそのまま出力する', () => {
    logUnhandledRejection('文字列エラー');

    const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logOutput.reason).toBe('文字列エラー');
    expect(logOutput.stack).toBeUndefined();
  });

  it('数値の場合、reasonに文字列変換して出力する', () => {
    logUnhandledRejection(42);

    const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logOutput.reason).toBe('42');
  });

  it('nullの場合、reasonに"null"と出力する', () => {
    logUnhandledRejection(null);

    const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
    expect(logOutput.reason).toBe('null');
  });

  it('loggerが提供された場合、Errorオブジェクトでlogger.fatalを使用する', () => {
    const mockLogger: ProcessLogger = { fatal: vi.fn() };
    const error = new Error('Promise拒否');

    logUnhandledRejection(error, mockLogger);

    expect(mockLogger.fatal).toHaveBeenCalledWith(
      { err: error, reason: 'Error: Promise拒否' },
      '未処理のPromise拒否が発生しました'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('loggerが提供された場合、非Errorでlogger.fatalを使用する', () => {
    const mockLogger: ProcessLogger = { fatal: vi.fn() };

    logUnhandledRejection('文字列エラー', mockLogger);

    expect(mockLogger.fatal).toHaveBeenCalledWith(
      { err: undefined, reason: '文字列エラー' },
      '未処理のPromise拒否が発生しました'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe('registerProcessHandlers', () => {
  let originalListeners: {
    uncaughtException: NodeJS.UncaughtExceptionListener[];
    unhandledRejection: NodeJS.UnhandledRejectionListener[];
  };

  beforeEach(() => {
    // 既存のリスナーを保存し、テスト後に復元する
    originalListeners = {
      uncaughtException: process.listeners(
        'uncaughtException'
      ) as NodeJS.UncaughtExceptionListener[],
      unhandledRejection: process.listeners(
        'unhandledRejection'
      ) as NodeJS.UnhandledRejectionListener[],
    };
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  afterEach(() => {
    // テストで追加されたリスナーを削除し、元のリスナーを復元
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    for (const listener of originalListeners.uncaughtException) {
      process.on('uncaughtException', listener);
    }
    for (const listener of originalListeners.unhandledRejection) {
      process.on('unhandledRejection', listener);
    }
  });

  it('uncaughtExceptionとunhandledRejectionのリスナーを登録する', () => {
    registerProcessHandlers({ getShutdownFn: () => null });

    expect(process.listenerCount('uncaughtException')).toBe(1);
    expect(process.listenerCount('unhandledRejection')).toBe(1);
  });
});

describe('triggerShutdown', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    process.exit = vi.fn() as never;
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.useRealTimers();
  });

  it('shutdownFnがnullの場合、即座にprocess.exit(1)する', () => {
    triggerShutdown(null, 'uncaughtException', 5000);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('shutdownFnが提供された場合、signal="uncaughtException"とexitCode=1で呼び出す', () => {
    const mockShutdown = vi.fn<ShutdownFn>().mockResolvedValue(undefined);

    triggerShutdown(mockShutdown, 'uncaughtException', 5000);

    expect(mockShutdown).toHaveBeenCalledWith('uncaughtException', 1);
  });

  it('shutdownFnが提供された場合、signal="unhandledRejection"で呼び出す', () => {
    const mockShutdown = vi.fn<ShutdownFn>().mockResolvedValue(undefined);

    triggerShutdown(mockShutdown, 'unhandledRejection', 5000);

    expect(mockShutdown).toHaveBeenCalledWith('unhandledRejection', 1);
  });

  it('shutdownFnが例外をスローしても、プロセスがクラッシュしない', () => {
    const mockShutdown = vi.fn<ShutdownFn>().mockRejectedValue(new Error('shutdown失敗'));

    expect(() => triggerShutdown(mockShutdown, 'uncaughtException', 5000)).not.toThrow();
    expect(mockShutdown).toHaveBeenCalled();
  });

  it('セーフティネットタイムアウトでprocess.exit(1)が呼ばれる', () => {
    const mockShutdown = vi.fn<ShutdownFn>().mockReturnValue(new Promise(() => {}));

    triggerShutdown(mockShutdown, 'uncaughtException', 5000);

    // shutdownFnが呼ばれた直後はexitされない
    expect(process.exit).not.toHaveBeenCalled();

    // タイムアウト後にexitされる
    vi.advanceTimersByTime(5000);
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('セーフティネットのタイムアウト値をカスタマイズできる', () => {
    const mockShutdown = vi.fn<ShutdownFn>().mockReturnValue(new Promise(() => {}));

    triggerShutdown(mockShutdown, 'uncaughtException', 3000);

    // 3秒前ではexitされない
    vi.advanceTimersByTime(2999);
    expect(process.exit).not.toHaveBeenCalled();

    // 3秒後にexitされる
    vi.advanceTimersByTime(1);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
