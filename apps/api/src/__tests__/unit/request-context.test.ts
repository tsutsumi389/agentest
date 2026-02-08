import { describe, it, expect } from 'vitest';
import { requestContext, getRequestId } from '../../lib/request-context.js';

describe('request-context', () => {
  describe('getRequestId', () => {
    it('コンテキスト外ではundefinedを返す', () => {
      expect(getRequestId()).toBeUndefined();
    });

    it('requestContext.run()内で正しいIDを返す', () => {
      requestContext.run({ requestId: 'req-abc-123' }, () => {
        expect(getRequestId()).toBe('req-abc-123');
      });
    });

    it('ネストした非同期処理でコンテキストが伝搬される', async () => {
      await requestContext.run({ requestId: 'req-async-456' }, async () => {
        // 直接アクセス
        expect(getRequestId()).toBe('req-async-456');

        // Promise経由
        const id = await Promise.resolve().then(() => getRequestId());
        expect(id).toBe('req-async-456');

        // setTimeout相当（setImmediate経由）
        const id2 = await new Promise<string | undefined>((resolve) => {
          setImmediate(() => resolve(getRequestId()));
        });
        expect(id2).toBe('req-async-456');
      });
    });

    it('異なるコンテキストが互いに干渉しない', async () => {
      const results: (string | undefined)[] = [];

      await Promise.all([
        requestContext.run({ requestId: 'req-1' }, async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(getRequestId());
        }),
        requestContext.run({ requestId: 'req-2' }, async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(getRequestId());
        }),
      ]);

      expect(results).toContain('req-1');
      expect(results).toContain('req-2');
      expect(results).toHaveLength(2);
    });
  });
});
