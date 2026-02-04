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
  });
});
