/**
 * メトリクス関連コード削除の確認テスト
 * SaaS→OSS転換に伴い、admin-metrics型・バリデーションが削除されていることを検証
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('メトリクス関連コードの削除確認', () => {
  const typesDir = path.resolve(__dirname, '../types');
  const schemasPath = path.resolve(__dirname, '../validators/schemas.ts');

  it('admin-metrics.ts が存在しないこと', () => {
    const filePath = path.join(typesDir, 'admin-metrics.ts');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('types/index.ts に admin-metrics の再エクスポートがないこと', () => {
    const indexPath = path.join(typesDir, 'index.ts');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).not.toContain('admin-metrics');
  });

  it('schemas.ts に activeUserMetricsQuerySchema がないこと', () => {
    const content = fs.readFileSync(schemasPath, 'utf-8');
    expect(content).not.toContain('activeUserMetricsQuerySchema');
  });
});
