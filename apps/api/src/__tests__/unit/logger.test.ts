import { describe, it, expect } from 'vitest';
import { Writable } from 'stream';
import { createLogger } from '@agentest/shared/logger';

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

describe('api logger', () => {
  it('Pinoベースのロガーとして構造化JSONを出力する', () => {
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'api', level: 'debug' }, stream);

    logger.info({ userId: 'user-1', method: 'GET' }, 'リクエスト処理');

    expect(lines.length).toBe(1);
    const output = JSON.parse(lines[0]);
    expect(output.level).toBe('info');
    expect(output.msg).toBe('リクエスト処理');
    expect(output.service).toBe('api');
    expect(output.userId).toBe('user-1');
    expect(output.method).toBe('GET');
    expect(output.time).toBeDefined();
  });

  it('warnレベルのログを出力する', () => {
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'api', level: 'debug' }, stream);

    logger.warn('警告メッセージ');

    const output = JSON.parse(lines[0]);
    expect(output.level).toBe('warn');
    expect(output.msg).toBe('警告メッセージ');
  });

  it('errorレベルのログを出力する', () => {
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'api', level: 'debug' }, stream);

    logger.error({ err: new Error('テストエラー') }, 'エラー発生');

    const output = JSON.parse(lines[0]);
    expect(output.level).toBe('error');
    expect(output.msg).toBe('エラー発生');
    expect(output.err).toBeDefined();
  });

  it('child loggerでモジュールコンテキストを追加できる', () => {
    const { stream, lines } = createTestStream();
    const baseLogger = createLogger({ service: 'api', level: 'debug' }, stream);
    const childLogger = baseLogger.child({ module: 'webhook' });

    childLogger.info('Webhook処理');

    const output = JSON.parse(lines[0]);
    expect(output.service).toBe('api');
    expect(output.module).toBe('webhook');
    expect(output.msg).toBe('Webhook処理');
  });

  it('タイムスタンプがISO 8601形式である', () => {
    const { stream, lines } = createTestStream();
    const logger = createLogger({ service: 'api', level: 'debug' }, stream);

    logger.info('テスト');

    const output = JSON.parse(lines[0]);
    expect(output.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
