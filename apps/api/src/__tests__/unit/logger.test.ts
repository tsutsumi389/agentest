import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../utils/logger.js';

describe('logger', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('infoレベルのログをJSON形式で出力する', () => {
    logger.info('テストメッセージ');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(infoSpy.mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.message).toBe('テストメッセージ');
    expect(output.timestamp).toBeDefined();
  });

  it('warnレベルのログを出力する', () => {
    logger.warn('警告メッセージ');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(output.level).toBe('warn');
    expect(output.message).toBe('警告メッセージ');
  });

  it('errorレベルのログを出力する', () => {
    logger.error('エラーメッセージ');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.message).toBe('エラーメッセージ');
  });

  it('コンテキスト情報をログに含める', () => {
    logger.info('リクエスト', { userId: 'user-1', method: 'GET' });
    const output = JSON.parse(infoSpy.mock.calls[0][0]);
    expect(output.userId).toBe('user-1');
    expect(output.method).toBe('GET');
  });

  it('debugレベルはLOG_LEVEL=debugの場合のみ出力する', () => {
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';

    logger.debug('デバッグメッセージ');
    expect(debugSpy).toHaveBeenCalledTimes(1);

    process.env.LOG_LEVEL = originalLogLevel;
  });

  it('debugレベルはLOG_LEVELが未設定の場合は出力しない', () => {
    const originalLogLevel = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;

    logger.debug('デバッグメッセージ');
    expect(debugSpy).not.toHaveBeenCalled();

    process.env.LOG_LEVEL = originalLogLevel;
  });

  it('タイムスタンプがISO 8601形式である', () => {
    logger.info('テスト');
    const output = JSON.parse(infoSpy.mock.calls[0][0]);
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('コンテキストなしでも動作する', () => {
    logger.info('コンテキストなし');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(infoSpy.mock.calls[0][0]);
    expect(output.message).toBe('コンテキストなし');
  });
});
