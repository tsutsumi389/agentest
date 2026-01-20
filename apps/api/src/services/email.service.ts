import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

/**
 * メール送信パラメータ
 */
interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * メールサービス
 * 環境に応じてMailpit（開発/ステージング）または実SMTP（本番）を使用
 */
class EmailService {
  private transporter: Transporter;

  constructor() {
    // SMTP設定から環境を判定
    // 開発環境: Mailpit (localhost:1025 または mailpit:1025)
    // 本番環境: 実SMTP (SendGrid等)
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
    });
  }

  /**
   * メールを送信
   */
  async send(params: SendEmailParams): Promise<void> {
    const { to, subject, text, html } = params;

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      });

      // 開発環境ではログ出力
      if (env.NODE_ENV !== 'production') {
        console.log('📧 [EMAIL SENT]', {
          to,
          subject,
          mailpitUrl: 'http://localhost:8025',
        });
      }
    } catch (error) {
      console.error('📧 [EMAIL ERROR]', {
        to,
        subject,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // エラーは握りつぶさず、呼び出し元でハンドリングできるようにする
      // ただし、通知送信失敗でアプリ全体がクラッシュしないよう注意
      throw error;
    }
  }

  /**
   * SMTP接続をテスト
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

// シングルトンインスタンス
export const emailService = new EmailService();
