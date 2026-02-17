/**
 * メトリクスジョブ削除の確認テスト
 * SaaS→OSS転換に伴い、メトリクス関連ジョブが削除されていることを検証
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('メトリクスジョブの削除確認', () => {
  const jobsDir = path.resolve(__dirname, '../../jobs');
  const libDir = path.resolve(__dirname, '../../lib');
  const indexPath = path.resolve(__dirname, '../../index.ts');

  it('metrics-aggregation.ts が存在しないこと', () => {
    expect(fs.existsSync(path.join(jobsDir, 'metrics-aggregation.ts'))).toBe(false);
  });

  it('metrics-backfill.ts が存在しないこと', () => {
    expect(fs.existsSync(path.join(jobsDir, 'metrics-backfill.ts'))).toBe(false);
  });

  it('metrics-utils.ts が存在しないこと', () => {
    expect(fs.existsSync(path.join(libDir, 'metrics-utils.ts'))).toBe(false);
  });

  it('index.ts にメトリクスジョブの参照がないこと', () => {
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).not.toContain('metrics-aggregation');
    expect(content).not.toContain('metrics-backfill');
    expect(content).not.toContain('MetricsAggregation');
    expect(content).not.toContain('MetricsBackfill');
  });
});
