import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('totp-crypto', () => {
  const VALID_KEY = 'a'.repeat(64); // 64文字hex（256-bit）

  beforeEach(() => {
    vi.stubEnv('TOTP_ENCRYPTION_KEY', VALID_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // テスト対象を動的にインポート（環境変数の変更を反映するため）
  async function importModule() {
    // モジュールキャッシュをクリアして再インポート
    vi.resetModules();
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
        'JBSWY3DPEHPK3PXP',       // 一般的なBase32
        'ABCDEFGHIJKLMNOP',        // アルファベットのみ
        'A2B3C4D5E6F7G8H9',       // 英数字混合
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

    it('TOTP_ENCRYPTION_KEY が未設定の場合にエラーが発生する', async () => {
      vi.stubEnv('TOTP_ENCRYPTION_KEY', '');
      const { encryptTotpSecret } = await importModule();

      expect(() => encryptTotpSecret('JBSWY3DPEHPK3PXP')).toThrow(
        'TOTP_ENCRYPTION_KEY'
      );
    });

    it('TOTP_ENCRYPTION_KEY が未定義の場合に復号でもエラーが発生する', async () => {
      vi.stubEnv('TOTP_ENCRYPTION_KEY', '');
      const { decryptTotpSecret } = await importModule();

      expect(() => decryptTotpSecret('enc:v1:dummy:dummy:dummy')).toThrow(
        'TOTP_ENCRYPTION_KEY'
      );
    });

    it('TOTP_ENCRYPTION_KEY が短すぎる場合にエラーが発生する', async () => {
      vi.stubEnv('TOTP_ENCRYPTION_KEY', 'short-key');
      const { encryptTotpSecret } = await importModule();

      expect(() => encryptTotpSecret('JBSWY3DPEHPK3PXP')).toThrow(
        '最低32文字'
      );
    });

    it('異なるキーで暗号化されたシークレットは復号できない', async () => {
      const { encryptTotpSecret } = await importModule();
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret);

      // 別のキーに変更
      vi.stubEnv('TOTP_ENCRYPTION_KEY', 'b'.repeat(64));
      const { decryptTotpSecret } = await importModule();

      expect(() => decryptTotpSecret(encrypted)).toThrow();
    });
  });
});
