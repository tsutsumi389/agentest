import { describe, it, expect, vi } from 'vitest';

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('@agentest/shared/logger', () => ({
  createLogger: () => mockLogger,
}));

import { nodeEnvSchema } from '@agentest/shared/config';

describe('config/env', () => {
  describe('nodeEnvSchema', () => {
    it('未定義の場合はdevelopmentがデフォルト', () => {
      expect(nodeEnvSchema.parse(undefined)).toBe('development');
    });

    it('productionを正しくパース', () => {
      expect(nodeEnvSchema.parse('production')).toBe('production');
    });

    it('testを正しくパース', () => {
      expect(nodeEnvSchema.parse('test')).toBe('test');
    });

    it('不正な値でエラー', () => {
      expect(() => nodeEnvSchema.parse('invalid')).toThrow();
    });
  });
});
