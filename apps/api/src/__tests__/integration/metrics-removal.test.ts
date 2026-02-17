/**
 * メトリクス関連テストヘルパー削除の確認テスト
 * SaaS→OSS転換に伴い、test-helpers.tsからメトリクス関連が削除されていることを検証
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('テストヘルパーのメトリクス関連削除確認', () => {
  const helpersPath = path.resolve(__dirname, './test-helpers.ts');

  it('test-helpers.ts に activeUserMetric の参照がないこと', () => {
    const content = fs.readFileSync(helpersPath, 'utf-8');
    expect(content).not.toContain('activeUserMetric');
  });

  it('test-helpers.ts に createTestActiveUserMetric がないこと', () => {
    const content = fs.readFileSync(helpersPath, 'utf-8');
    expect(content).not.toContain('createTestActiveUserMetric');
  });
});
