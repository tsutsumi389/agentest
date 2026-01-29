/**
 * メール送信ユーティリティ
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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

  console.log('[Jobs] SMTPトランスポーターを初期化しました');
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

  console.log(`[Jobs] メール送信: ${to} - ${subject}`);
}

/**
 * 履歴削除予告メールを生成
 */
export function generateHistoryExpiryEmail(
  userName: string,
  daysUntilDeletion: number,
  historyCount: number
): { subject: string; text: string; html: string } {
  const greeting = userName ? `${userName}様` : 'ユーザー様';

  const subject = `[Agentest] 変更履歴が${daysUntilDeletion}日後に削除されます`;

  const text = `${greeting}

いつもAgentestをご利用いただきありがとうございます。

お使いのFREEプランでは、30日を経過した変更履歴は自動的に削除されます。
現在、約${historyCount}件の変更履歴が${daysUntilDeletion}日以内に削除予定です。

変更履歴を永続的に保存したい場合は、PROプランへのアップグレードをご検討ください。
PROプランでは、変更履歴の保存期間に制限がありません。

プランの詳細はこちら:
https://agentest.app/settings/subscription

---
Agentest - テスト管理ツール
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-bottom: 20px; }
    .content { padding: 20px 0; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; }
    .cta { display: inline-block; background: #6366f1; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { border-top: 1px solid #e5e5e5; padding-top: 20px; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="font-size: 24px; margin: 0;">Agentest</h1>
    </div>
    <div class="content">
      <p>${greeting}</p>
      <p>いつもAgentestをご利用いただきありがとうございます。</p>

      <div class="alert">
        <strong>変更履歴の削除予告</strong><br>
        現在、約<strong>${historyCount}件</strong>の変更履歴が<strong>${daysUntilDeletion}日以内</strong>に削除予定です。
      </div>

      <p>お使いのFREEプランでは、30日を経過した変更履歴は自動的に削除されます。</p>

      <p>変更履歴を永続的に保存したい場合は、PROプランへのアップグレードをご検討ください。<br>
      PROプランでは、変更履歴の保存期間に制限がありません。</p>

      <a href="https://agentest.app/settings/subscription" class="cta">プランを確認する</a>
    </div>
    <div class="footer">
      <p>Agentest - テスト管理ツール</p>
    </div>
  </div>
</body>
</html>
`;

  return { subject, text, html };
}
