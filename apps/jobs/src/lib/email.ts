/**
 * メール送信ユーティリティ
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'email' });

/**
 * メール送信パラメータ
 */
export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;

/**
 * SMTPトランスポーターを取得
 */
function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    throw new Error('SMTP_HOSTが設定されていません');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user
      ? {
          user,
          pass,
        }
      : undefined,
  });

  logger.info('SMTPトランスポーターを初期化しました');
  return transporter;
}

/**
 * メールを送信
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { to, subject, text, html } = params;
  const from = process.env.SMTP_FROM || 'noreply@agentest.local';

  const transport = getTransporter();

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  logger.debug({ to, subject }, 'メール送信');
}
