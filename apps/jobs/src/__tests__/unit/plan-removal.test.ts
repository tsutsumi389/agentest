/**
 * プラン制限・UsageRecord 削除の回帰テスト
 * SaaS→OSS転換に伴い、プラン関連コードが削除されていることを検証
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('プラン制限・UsageRecord の削除確認', () => {
  const sharedConfigDir = path.resolve(__dirname, '../../../../packages/shared/src/config');
  const historyCleanupPath = path.resolve(__dirname, '../../jobs/history-cleanup.ts');

  it('plan-pricing.ts が存在しないこと', () => {
    expect(fs.existsSync(path.join(sharedConfigDir, 'plan-pricing.ts'))).toBe(false);
  });

  it('history-cleanup.ts にプラン関連の参照がないこと', () => {
    const content = fs.readFileSync(historyCleanupPath, 'utf-8');
    expect(content).not.toContain('UserPlan');
    expect(content).not.toContain('OrganizationPlan');
    expect(content).not.toContain('PLAN_LIMITS');
    expect(content).not.toContain('FREE');
    expect(content).not.toContain('PRO');
    expect(content).not.toContain('UsageRecord');
  });

  it('history-cleanup.ts が環境変数で保持日数を設定できること', () => {
    const content = fs.readFileSync(historyCleanupPath, 'utf-8');
    expect(content).toContain('process.env');
    expect(content).toContain('HISTORY_RETENTION_DAYS');
  });
});
