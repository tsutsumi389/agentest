import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptToken, decryptToken } from '../../utils/crypto.js';

const TEST_KEY = 'test-encryption-key-for-unit-tests';

describe('crypto', () => {
  describe('encrypt / decrypt ラウンドトリップ', () => {
    it('暗号化→復号で元のテキストに戻る', () => {
      const plaintext = 'gho_abc123def456';
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it('空文字列も暗号化/復号できる', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it('長いトークンも暗号化/復号できる', () => {
      const plaintext = 'ya29.a0AfH6SMB' + 'x'.repeat(500);
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });

    it('マルチバイト文字を含むテキストも暗号化/復号できる', () => {
      const plaintext = 'テスト用トークン🔑';
      const encrypted = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, TEST_KEY);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('暗号化の一意性', () => {
    it('同じ平文でも毎回異なる暗号文が生成される（IVがランダム）', () => {
      const plaintext = 'gho_abc123def456';
      const encrypted1 = encrypt(plaintext, TEST_KEY);
      const encrypted2 = encrypt(plaintext, TEST_KEY);

      expect(encrypted1).not.toBe(encrypted2);

      // どちらも復号できる
      expect(decrypt(encrypted1, TEST_KEY)).toBe(plaintext);
      expect(decrypt(encrypted2, TEST_KEY)).toBe(plaintext);
    });
  });

  describe('暗号文のフォーマット', () => {
    it('iv:authTag:ciphertext のコロン区切り形式になる', () => {
      const encrypted = encrypt('test', TEST_KEY);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      // 各パートがBase64デコード可能であること
      for (const part of parts) {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      }
    });

    it('IVは12バイト（Base64で16文字）', () => {
      const encrypted = encrypt('test', TEST_KEY);
      const ivBase64 = encrypted.split(':')[0];
      const iv = Buffer.from(ivBase64, 'base64');

      expect(iv.length).toBe(12);
    });

    it('AuthTagは16バイト（Base64で24文字）', () => {
      const encrypted = encrypt('test', TEST_KEY);
      const authTagBase64 = encrypted.split(':')[1];
      const authTag = Buffer.from(authTagBase64, 'base64');

      expect(authTag.length).toBe(16);
    });
  });

  describe('復号エラー', () => {
    it('不正な形式の暗号文で例外が発生する', () => {
      expect(() => decrypt('invalid-format', TEST_KEY)).toThrow('不正な暗号文形式です');
    });

    it('パーツ数が足りない場合に例外が発生する', () => {
      expect(() => decrypt('part1:part2', TEST_KEY)).toThrow('不正な暗号文形式です');
    });

    it('パーツ数が多い場合に例外が発生する', () => {
      expect(() => decrypt('p1:p2:p3:p4', TEST_KEY)).toThrow('不正な暗号文形式です');
    });

    it('異なるキーで復号するとエラーになる', () => {
      const encrypted = encrypt('secret-token', TEST_KEY);
      expect(() => decrypt(encrypted, 'wrong-key')).toThrow();
    });

    it('改ざんされた暗号文で復号するとエラーになる', () => {
      const encrypted = encrypt('secret-token', TEST_KEY);
      const parts = encrypted.split(':');
      // 暗号文の先頭を改ざん
      const tampered = parts[0] + ':' + parts[1] + ':' + 'AAAA' + parts[2].slice(4);
      expect(() => decrypt(tampered, TEST_KEY)).toThrow();
    });

    it('改ざんされたAuthTagで復号するとエラーになる', () => {
      const encrypted = encrypt('secret-token', TEST_KEY);
      const parts = encrypted.split(':');
      // AuthTagを改ざん
      const tampered = parts[0] + ':' + 'AAAA' + parts[1].slice(4) + ':' + parts[2];
      expect(() => decrypt(tampered, TEST_KEY)).toThrow();
    });
  });

  describe('encryptToken / decryptToken', () => {
    it('文字列トークンを暗号化/復号できる', () => {
      const token = 'gho_abc123def456';
      const encrypted = encryptToken(token, TEST_KEY);

      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toBe(token);

      const decrypted = decryptToken(encrypted, TEST_KEY);
      expect(decrypted).toBe(token);
    });

    it('nullはそのままnullを返す', () => {
      expect(encryptToken(null, TEST_KEY)).toBeNull();
      expect(decryptToken(null, TEST_KEY)).toBeNull();
    });

    it('undefinedはnullを返す', () => {
      expect(encryptToken(undefined, TEST_KEY)).toBeNull();
      expect(decryptToken(undefined, TEST_KEY)).toBeNull();
    });

    it('暗号化されていない平文トークンはそのまま返す（後方互換性）', () => {
      // 既存のDBに保存されている平文トークン
      expect(decryptToken('gho_abc123def456', TEST_KEY)).toBe('gho_abc123def456');
      expect(decryptToken('ya29.a0AfH6SMBxyz', TEST_KEY)).toBe('ya29.a0AfH6SMBxyz');
    });

    it('コロンを含むが暗号化形式でない文字列はそのまま返す', () => {
      expect(decryptToken('not:encrypted:format', TEST_KEY)).toBe('not:encrypted:format');
    });
  });
});
