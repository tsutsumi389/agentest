/**
 * メトリクスページ削除の確認テスト
 * SaaS→OSS転換に伴い、管理画面メトリクスページが削除されていることを検証
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('メトリクスページの削除確認', () => {
  const pagesDir = path.resolve(__dirname, '../pages');
  const appPath = path.resolve(__dirname, '../App.tsx');
  const navLinksPath = path.resolve(__dirname, '../components/layout/nav-links.ts');

  it('MetricsPage.tsx が存在しないこと', () => {
    expect(fs.existsSync(path.join(pagesDir, 'MetricsPage.tsx'))).toBe(false);
  });

  it('App.tsx に /metrics ルートがないこと', () => {
    const content = fs.readFileSync(appPath, 'utf-8');
    expect(content).not.toContain('MetricsPage');
    expect(content).not.toContain('/metrics');
  });

  it('nav-links.ts にメトリクスリンクがないこと', () => {
    const content = fs.readFileSync(navLinksPath, 'utf-8');
    expect(content).not.toContain('TrendingUp');
    expect(content).not.toContain('/metrics');
    expect(content).not.toContain('メトリクス');
  });
});
