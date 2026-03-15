import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Writable } from 'stream';

/**
 * テスト用のストリームを作成し、書き込まれたログ行を配列に収集する
 */
function createTestStream(): { stream: Writable; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString().trim());
      callback();
    },
  });
  return { stream, lines };
}

// 全describeブロックで共通の環境変数管理
const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.LOG_LEVEL;
  delete process.env.LOG_PRETTY;
  delete process.env.NODE_ENV;
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('createLogger', () => {
  it('サービス名を指定してロガーを作成できる', async () => {
    const { createLogger } = await import('./index.js');
    const logger = createLogger({ service: 'api' });

    expect(logger).toBeDefined();
    expect(logger.info).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
    expect(logger.warn).toBeTypeOf('function');
    expect(logger.debug).toBeTypeOf('function');
    expect(logger.fatal).toBeTypeOf('function');
  });

  it('JSON形式で構造化ログを出力する', async () => {
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test-service' }, stream);

    logger.info('テストメッセージ');

    expect(lines.length).toBeGreaterThan(0);
    const logLine = JSON.parse(lines[0]);
    expect(logLine.msg).toBe('テストメッセージ');
    expect(logLine.service).toBe('test-service');
    expect(logLine.level).toBe('info');
  });

  it('ログレベルがラベル形式で出力される（数値ではなく）', async () => {
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test' }, stream);

    logger.warn('警告メッセージ');

    const logLine = JSON.parse(lines[0]);
    expect(logLine.level).toBe('warn');
    // 数値レベル（例: 40）ではなくラベルであること
    expect(typeof logLine.level).toBe('string');
  });

  it('タイムスタンプがISO 8601形式で出力される', async () => {
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test' }, stream);

    logger.info('タイムスタンプテスト');

    const logLine = JSON.parse(lines[0]);
    expect(logLine.time).toBeDefined();
    // ISO 8601形式であることを検証
    expect(() => new Date(logLine.time)).not.toThrow();
    expect(new Date(logLine.time).toISOString()).toBe(logLine.time);
  });

  it('env フィールドが出力に含まれる', async () => {
    process.env.NODE_ENV = 'production';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test' }, stream);

    logger.info('env テスト');

    const logLine = JSON.parse(lines[0]);
    expect(logLine.env).toBe('production');
  });
});

describe('createLogger - ログレベル制御', () => {
  it('LOG_LEVEL環境変数でログレベルを指定できる', async () => {
    process.env.LOG_LEVEL = 'warn';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test' }, stream);

    // info はwarnレベル以下なので出力されない
    logger.info('抑制されるメッセージ');
    // warn は出力される
    logger.warn('表示されるメッセージ');

    expect(lines.length).toBe(1);
    const logLine = JSON.parse(lines[0]);
    expect(logLine.msg).toBe('表示されるメッセージ');
  });

  it('オプションでログレベルを直接指定できる', async () => {
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test', level: 'error' }, stream);

    logger.warn('抑制される');
    logger.error('表示される');

    expect(lines.length).toBe(1);
    const logLine = JSON.parse(lines[0]);
    expect(logLine.msg).toBe('表示される');
  });

  it('無効なoptions.levelを指定した場合、エラーをスローする', async () => {
    const { createLogger } = await import('./index.js');

    expect(() => createLogger({ service: 'test', level: 'verbose' as never })).toThrow(
      'Invalid log level: "verbose"'
    );
  });

  it('無効なLOG_LEVELの場合、警告を出力してNODE_ENVベースのデフォルトにフォールバックする', async () => {
    process.env.LOG_LEVEL = 'verbose';
    process.env.NODE_ENV = 'production';
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test' }, stream);

    // productionのデフォルト(info)が適用される
    logger.debug('抑制される');
    logger.info('表示される');

    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0]).msg).toBe('表示される');

    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    const warnOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0] as string);
    expect(warnOutput.msg).toContain('Invalid LOG_LEVEL');
    expect(warnOutput.validLevels).toBeDefined();

    consoleWarnSpy.mockRestore();
  });

  it('NODE_ENV=production の場合、デフォルトレベルは info', async () => {
    process.env.NODE_ENV = 'production';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test' }, stream);

    logger.debug('抑制される');
    logger.info('表示される');

    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0]).msg).toBe('表示される');
  });

  it('NODE_ENV=test の場合、デフォルトレベルは silent', async () => {
    process.env.NODE_ENV = 'test';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'test' }, stream);

    logger.info('抑制される');
    logger.error('抑制される');

    expect(lines.length).toBe(0);
  });
});

describe('createLogger - child logger', () => {
  it('child loggerでモジュールコンテキストを追加できる', async () => {
    process.env.NODE_ENV = 'development';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const baseLogger = createLogger({ service: 'api' }, stream);
    const childLogger = baseLogger.child({ module: 'events' });

    childLogger.info('イベント処理');

    expect(lines.length).toBeGreaterThan(0);
    const logLine = JSON.parse(lines[0]);
    expect(logLine.service).toBe('api');
    expect(logLine.module).toBe('events');
    expect(logLine.msg).toBe('イベント処理');
  });

  it('child loggerでリクエストIDを追加できる', async () => {
    process.env.NODE_ENV = 'development';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const baseLogger = createLogger({ service: 'api' }, stream);
    const reqLogger = baseLogger.child({ requestId: 'req-123' });

    reqLogger.info('リクエスト処理');

    const logLine = JSON.parse(lines[0]);
    expect(logLine.requestId).toBe('req-123');
  });
});

describe('createLogger - mixin', () => {
  it('mixinオプションで動的にフィールドを追加できる', async () => {
    process.env.NODE_ENV = 'development';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger(
      {
        service: 'api',
        mixin: () => ({ requestId: 'mixin-req-001', traceId: 'trace-xyz' }),
      },
      stream
    );

    logger.info('mixinテスト');

    const logLine = JSON.parse(lines[0]);
    expect(logLine.requestId).toBe('mixin-req-001');
    expect(logLine.traceId).toBe('trace-xyz');
    expect(logLine.msg).toBe('mixinテスト');
  });

  it('mixinが空オブジェクトを返す場合は追加フィールドなし', async () => {
    process.env.NODE_ENV = 'development';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    const logger = createLogger(
      {
        service: 'api',
        mixin: () => ({}),
      },
      stream
    );

    logger.info('空mixinテスト');

    const logLine = JSON.parse(lines[0]);
    expect(logLine.msg).toBe('空mixinテスト');
    expect(logLine.service).toBe('api');
    // requestIdが含まれないこと
    expect(logLine.requestId).toBeUndefined();
  });

  it('mixinが毎回呼ばれて動的に値を返す', async () => {
    process.env.NODE_ENV = 'development';
    const { createLogger } = await import('./index.js');
    const { stream, lines } = createTestStream();
    let counter = 0;
    const logger = createLogger(
      {
        service: 'api',
        mixin: () => ({ callCount: ++counter }),
      },
      stream
    );

    logger.info('1回目');
    logger.info('2回目');

    const line1 = JSON.parse(lines[0]);
    const line2 = JSON.parse(lines[1]);
    expect(line1.callCount).toBe(1);
    expect(line2.callCount).toBe(2);
  });
});
