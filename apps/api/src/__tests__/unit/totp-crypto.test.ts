import { describe, it, expect, vi, beforeEach } from 'vitest';

// envモジュールをモック（TOTP_ENCRYPTION_KEYを制御可能にする）
const { mockEnv } = vi.hoisted(() => {
  return {
    mockEnv: {
      TOTP_ENCRYPTION_KEY: 'a'.repeat(64), // 64文字（256-bit相当）
    } as Record<string, string>,
  };
});

vi.mock('../../config/env.js', () => ({
  env: mockEnv,
}));

describe('totp-crypto', () => {
  const VALID_KEY = 'a'.repeat(64);

  beforeEach(() => {
    mockEnv.TOTP_ENCRYPTION_KEY = VALID_KEY;
  });

  // テスト対象を動的にインポート（モック値の変更を反映するため）
  async function importModule() {
    vi.resetModules();
    // vi.mockをリセット後に再登録
    vi.mock('../../config/env.js', () => ({
      env: mockEnv,
    }));
    return import('../../lib/totp-crypto.js');
  }

  describe('encryptTotpSecret', () => {
    it('平文のTOTPシークレットを暗号化文字列に変換する', async () => {
      const { encryptTotpSecret } = await importModule();
      const secret = 'JBSWY3DPEHPK3PXP'; // Base32 TOTP secret

      const encrypted = encryptTotpSecret(secret);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(secret);
      // enc:v1:プレフィックスを持つ
      expect(encrypted.startsWith('enc:v1:')).toBe(true);
    });

    it('同じ平文でも毎回異なる暗号文を生成する（IVのランダム性）', async () => {
      const { encryptTotpSecret } = await importModule();
      const secret = 'JBSWY3DPEHPK3PXP';

      const encrypted1 = encryptTotpSecret(secret);
      const encrypted2 = encryptTotpSecret(secret);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decryptTotpSecret', () => {
    it('暗号化されたTOTPシークレットを元の平文に復号する', async () => {
      const { encryptTotpSecret, decryptTotpSecret } = await importModule();
      const secret = 'JBSWY3DPEHPK3PXP';

      const encrypted = encryptTotpSecret(secret);
      const decrypted = decryptTotpSecret(encrypted);

      expect(decrypted).toBe(secret);
    });
  });

  describe('暗号化→復号ラウンドトリップ', () => {
    it('さまざまなTOTPシークレット形式でラウンドトリップが成功する', async () => {
      const { encryptTotpSecret, decryptTotpSecret } = await importModule();
      const secrets = [
        'JBSWY3DPEHPK3PXP', // 一般的なBase32
        'ABCDEFGHIJKLMNOP', // アルファベットのみ
        'A2B3C4D5E6F7G8H9', // 英数字混合
        'VERYLONGSECRETKEYTHATMIGHTBEUSEDINSOMECASES', // 長いシークレット
      ];

      for (const secret of secrets) {
        const encrypted = encryptTotpSecret(secret);
        const decrypted = decryptTotpSecret(encrypted);
        expect(decrypted).toBe(secret);
      }
    });
  });

  describe('エラーハンドリング', () => {
    it('不正な暗号文で復号するとエラーが発生する', async () => {
      const { decryptTotpSecret } = await importModule();

      expect(() => decryptTotpSecret('invalid-data')).toThrow();
    });

    it('改ざんされた暗号文で復号するとエラーが発生する', async () => {
      const { encryptTotpSecret, decryptTotpSecret } = await importModule();
      const secret = 'JBSWY3DPEHPK3PXP';

      const encrypted = encryptTotpSecret(secret);
      // 暗号文の一部を改ざん
      const tampered = encrypted.slice(0, -4) + 'XXXX';

      expect(() => decryptTotpSecret(tampered)).toThrow();
    });

    it('異なるキーで暗号化されたシークレットは復号できない', async () => {
      const { encryptTotpSecret } = await importModule();
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret);

      // 別のキーに変更
      mockEnv.TOTP_ENCRYPTION_KEY = 'b'.repeat(64);
      const { decryptTotpSecret } = await importModule();

      expect(() => decryptTotpSecret(encrypted)).toThrow();
    });
  });
});
