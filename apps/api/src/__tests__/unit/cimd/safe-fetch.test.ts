import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureUrlShape,
  isPrivateIp,
  safeFetchJson,
  SafeFetchError,
  type SafeFetchTransport,
} from '../../../utils/safe-fetch.js';

describe('safe-fetch', () => {
  describe('ensureUrlShape', () => {
    it('https URL を受け入れる', () => {
      expect(() => ensureUrlShape('https://example.com/path')).not.toThrow();
    });

    it('http スキームは拒否', () => {
      expect(() => ensureUrlShape('http://example.com/path')).toThrow(SafeFetchError);
    });

    it('fragment 含む URL は拒否', () => {
      expect(() => ensureUrlShape('https://example.com/path#frag')).toThrow(SafeFetchError);
    });

    it('userinfo 含む URL は拒否', () => {
      expect(() => ensureUrlShape('https://user:pass@example.com/path')).toThrow(SafeFetchError);
    });

    it('不正な URL は拒否', () => {
      expect(() => ensureUrlShape('not-a-url')).toThrow(SafeFetchError);
    });
  });

  describe('isPrivateIp', () => {
    it('IPv4 ループバックを拒否対象として判定する', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.255.255.254')).toBe(true);
    });

    it('IPv4 プライベートレンジを拒否対象として判定する', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('192.168.1.1')).toBe(true);
      expect(isPrivateIp('172.16.0.1')).toBe(true);
    });

    it('IPv4 リンクローカル / メタデータサービス IP を拒否対象として判定する', () => {
      expect(isPrivateIp('169.254.0.1')).toBe(true);
      expect(isPrivateIp('169.254.169.254')).toBe(true);
    });

    it('CGNAT (100.64.0.0/10) を拒否対象として判定する', () => {
      expect(isPrivateIp('100.64.0.1')).toBe(true);
      expect(isPrivateIp('100.127.255.254')).toBe(true);
    });

    it('IPv6 ループバック / ULA / リンクローカルを拒否対象として判定する', () => {
      expect(isPrivateIp('::1')).toBe(true);
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fe80::1')).toBe(true);
    });

    it('正常なグローバル IP は許可される', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
    });

    it('不正な IP 文字列は安全側で拒否扱いとする', () => {
      expect(isPrivateIp('not-an-ip')).toBe(true);
    });
  });

  describe('safeFetchJson', () => {
    let transport: SafeFetchTransport;
    let dnsLookup: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      transport = vi.fn();
      dnsLookup = vi.fn();
    });

    it('プライベート IP を解決した場合は SafeFetchError を投げる', async () => {
      dnsLookup.mockResolvedValue(['127.0.0.1']);
      await expect(
        safeFetchJson('https://internal.example.com/client', {
          timeoutMs: 5000,
          maxBytes: 5 * 1024,
          dnsLookup,
          transport: transport as SafeFetchTransport,
        })
      ).rejects.toThrow(SafeFetchError);
      expect(transport).not.toHaveBeenCalled();
    });

    it('一つでもプライベート IP が含まれていれば拒否 (DNS rebinding 対策)', async () => {
      dnsLookup.mockResolvedValue(['8.8.8.8', '127.0.0.1']);
      await expect(
        safeFetchJson('https://example.com/client', {
          timeoutMs: 5000,
          maxBytes: 5 * 1024,
          dnsLookup,
          transport: transport as SafeFetchTransport,
        })
      ).rejects.toThrow(SafeFetchError);
    });

    it('安全な IP のみが返ってきた場合は転送に委譲する', async () => {
      dnsLookup.mockResolvedValue(['8.8.8.8']);
      (transport as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify({ ok: true })),
      });

      const res = await safeFetchJson('https://example.com/client', {
        timeoutMs: 5000,
        maxBytes: 5 * 1024,
        dnsLookup,
        transport: transport as SafeFetchTransport,
      });

      expect(res.status).toBe(200);
      expect(transport).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'example.com',
          ip: '8.8.8.8',
          maxBytes: 5 * 1024,
          timeoutMs: 5000,
        })
      );
    });

    it('Content-Type が application/json でない場合は SafeFetchError', async () => {
      dnsLookup.mockResolvedValue(['8.8.8.8']);
      (transport as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: Buffer.from('<html></html>'),
      });

      await expect(
        safeFetchJson('https://example.com/client', {
          timeoutMs: 5000,
          maxBytes: 5 * 1024,
          dnsLookup,
          transport: transport as SafeFetchTransport,
        })
      ).rejects.toThrow(SafeFetchError);
    });

    it('304 Not Modified は body=null で返す (Content-Type 検証スキップ)', async () => {
      dnsLookup.mockResolvedValue(['8.8.8.8']);
      (transport as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 304,
        headers: {},
        body: null,
      });

      const res = await safeFetchJson('https://example.com/client', {
        timeoutMs: 5000,
        maxBytes: 5 * 1024,
        dnsLookup,
        transport: transport as SafeFetchTransport,
      });

      expect(res.status).toBe(304);
      expect(res.body).toBeNull();
    });

    it('最初に http URL が渡された場合は拒否 (DNS 問い合わせ前)', async () => {
      await expect(
        safeFetchJson('http://example.com/client', {
          timeoutMs: 5000,
          maxBytes: 5 * 1024,
          dnsLookup,
          transport: transport as SafeFetchTransport,
        })
      ).rejects.toThrow(SafeFetchError);
      expect(dnsLookup).not.toHaveBeenCalled();
    });
  });
});
