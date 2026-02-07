import { describe, it, expect, vi, beforeEach } from 'vitest';

// nodemailerモック
const mockSendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockVerify = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
    }),
  },
}));

// envモック
vi.mock('../../config/env.js', () => ({
  env: {
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: 'test@example.com',
    NODE_ENV: 'development',
  },
}));

import { emailService } from '../../services/email.service.js';

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('send', () => {
    it('メールを送信できる', async () => {
      await emailService.send({
        to: 'user@example.com',
        subject: 'テスト件名',
        text: 'テスト本文',
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'user@example.com',
        subject: 'テスト件名',
        text: 'テスト本文',
        html: undefined,
      });
    });

    it('HTML付きメールを送信できる', async () => {
      await emailService.send({
        to: 'user@example.com',
        subject: 'テスト',
        text: 'テキスト',
        html: '<p>HTML</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ html: '<p>HTML</p>' })
      );
    });

    it('送信エラー時はエラーを再スローする', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(
        emailService.send({ to: 'user@example.com', subject: 'テスト', text: 'テスト' })
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('verify', () => {
    it('接続成功時はtrueを返す', async () => {
      const result = await emailService.verify();
      expect(result).toBe(true);
    });

    it('接続失敗時はfalseを返す', async () => {
      mockVerify.mockRejectedValueOnce(new Error('connection failed'));
      const result = await emailService.verify();
      expect(result).toBe(false);
    });
  });

  describe('generateAdminInvitationEmail', () => {
    const baseParams = {
      name: 'テスト太郎',
      inviterName: '管理者一郎',
      role: 'ADMIN',
      invitationUrl: 'https://example.com/invite/abc',
      expiresAt: new Date('2026-01-15T12:00:00Z'),
    };

    it('管理者招待メールを生成する', () => {
      const result = emailService.generateAdminInvitationEmail(baseParams);

      expect(result.subject).toBe('【Agentest】管理者アカウントへの招待');
      expect(result.text).toContain('テスト太郎');
      expect(result.text).toContain('管理者一郎');
      expect(result.text).toContain('一般管理者');
      expect(result.text).toContain('https://example.com/invite/abc');
      expect(result.html).toContain('テスト太郎');
      expect(result.html).toContain('一般管理者');
    });

    it('SUPER_ADMINロールを正しく変換する', () => {
      const result = emailService.generateAdminInvitationEmail({
        ...baseParams,
        role: 'SUPER_ADMIN',
      });

      expect(result.text).toContain('最高権限管理者');
      expect(result.html).toContain('最高権限管理者');
    });

    it('VIEWERロールを正しく変換する', () => {
      const result = emailService.generateAdminInvitationEmail({
        ...baseParams,
        role: 'VIEWER',
      });

      expect(result.text).toContain('閲覧専用');
    });

    it('未知のロールはそのまま表示する', () => {
      const result = emailService.generateAdminInvitationEmail({
        ...baseParams,
        role: 'CUSTOM_ROLE',
      });

      expect(result.text).toContain('CUSTOM_ROLE');
    });

    it('HTMLメールを含む', () => {
      const result = emailService.generateAdminInvitationEmail(baseParams);
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('アカウントを設定する');
      expect(result.html).toContain(baseParams.invitationUrl);
    });

    it('HTMLの特殊文字をエスケープしてXSSを防止する', () => {
      const xssParams = {
        ...baseParams,
        name: '<script>alert("xss")</script>',
        inviterName: '"><img src=x onerror=alert(1)>',
      };

      const result = emailService.generateAdminInvitationEmail(xssParams);

      // HTML部分ではタグとして解釈されないようエスケープされている
      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('<img ');
      expect(result.html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result.html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');

      // テキスト部分はエスケープ不要（プレーンテキスト）
      expect(result.text).toContain('<script>alert("xss")</script>');
    });

    it('未知のロールにHTML特殊文字が含まれてもエスケープする', () => {
      const result = emailService.generateAdminInvitationEmail({
        ...baseParams,
        role: '<b>HACKED</b>',
      });

      expect(result.html).not.toContain('<b>HACKED</b>');
      expect(result.html).toContain('&lt;b&gt;HACKED&lt;/b&gt;');
    });

    it('クエリパラメータに&を含むURLがhref属性で正しくエスケープされる', () => {
      // HTML仕様ではhref属性内の&は&amp;に変換されるのが正しい
      // ブラウザ/メールクライアントは&amp;を&に戻してリンクを辿る
      const urlWithAmpersand = 'https://example.com/invite?token=abc&org=123';
      const result = emailService.generateAdminInvitationEmail({
        ...baseParams,
        invitationUrl: urlWithAmpersand,
      });

      expect(result.html).toContain('href="https://example.com/invite?token=abc&amp;org=123"');
      // テキスト部分はエスケープ不要
      expect(result.text).toContain(urlWithAmpersand);
    });

    it('javascript: URIの招待URLを拒否する', () => {
      expect(() =>
        emailService.generateAdminInvitationEmail({
          ...baseParams,
          invitationUrl: 'javascript:alert(document.cookie)',
        })
      ).toThrow('許可されないURLプロトコル');
    });

    it('data: URIの招待URLを拒否する', () => {
      expect(() =>
        emailService.generateAdminInvitationEmail({
          ...baseParams,
          invitationUrl: 'data:text/html,<script>alert(1)</script>',
        })
      ).toThrow('許可されないURLプロトコル');
    });
  });
});
