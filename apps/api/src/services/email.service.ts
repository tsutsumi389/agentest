import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { escapeHtml, sanitizeUrl } from '../utils/html.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'email' });

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
 * パスワードリセットメールパラメータ
 */
interface PasswordResetEmailParams {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

/**
 * メールアドレス確認メールパラメータ
 */
interface EmailVerificationEmailParams {
  name: string;
  verificationUrl: string;
  expiresInHours: number;
}

/**
 * ウェルカムメールパラメータ
 */
interface WelcomeEmailParams {
  name: string;
  loginUrl: string;
}

/**
 * 管理者招待メールパラメータ
 */
interface AdminInvitationEmailParams {
  name: string;
  inviterName: string;
  role: string;
  invitationUrl: string;
  expiresAt: Date;
}

/**
 * 生成されたメールコンテンツ
 */
interface EmailContent {
  subject: string;
  text: string;
  html: string;
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
        logger.info(
          {
            to,
            subject,
            mailpitUrl: 'http://localhost:8025',
          },
          'メール送信完了'
        );
      }
    } catch (error) {
      logger.error(
        {
          err: error,
          to,
          subject,
        },
        'メール送信エラー'
      );
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

  /**
   * 管理者招待メールを生成
   */
  generateAdminInvitationEmail(params: AdminInvitationEmailParams): EmailContent {
    const { name, inviterName, role, invitationUrl, expiresAt } = params;

    // ロール名を日本語に変換
    const roleLabel = this.getRoleLabel(role);

    // 有効期限をフォーマット
    const expiresAtFormatted = expiresAt.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
    });

    const subject = '【Agentest】管理者アカウントへの招待';

    const text = `${name} 様

${inviterName} 様より、Agentest管理者アカウントへの招待が届いています。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
招待内容
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ロール: ${roleLabel}
有効期限: ${expiresAtFormatted}

以下のURLからパスワードを設定し、アカウントを有効化してください。

${invitationUrl}

※このリンクは24時間有効です。期限を過ぎた場合は、管理者に再度招待を依頼してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このメールに心当たりがない場合は、無視してください。

--
Agentest システム管理チーム
`;

    // URLプロトコル検証（javascript: URI等を防止）
    const validatedUrl = sanitizeUrl(invitationUrl);

    // XSS防止: HTMLテンプレートに挿入する値をエスケープ
    const safeName = escapeHtml(name);
    const safeInviterName = escapeHtml(inviterName);
    const safeRoleLabel = escapeHtml(roleLabel);
    const safeExpiresAt = escapeHtml(expiresAtFormatted);
    const safeInvitationUrl = escapeHtml(validatedUrl);

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理者アカウントへの招待</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #1a1a1a;
    }
    .info-box {
      background-color: #f8f9fa;
      border-radius: 4px;
      padding: 16px;
      margin: 16px 0;
    }
    .info-row {
      display: flex;
      margin-bottom: 8px;
    }
    .info-label {
      font-weight: bold;
      width: 100px;
      color: #666;
    }
    .info-value {
      color: #1a1a1a;
    }
    .button {
      display: inline-block;
      background-color: #1a1a1a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: bold;
      margin: 24px 0;
    }
    .button:hover {
      background-color: #333;
    }
    .note {
      font-size: 14px;
      color: #666;
      margin-top: 24px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Agentest</div>
    </div>

    <h1>${safeName} 様</h1>

    <p>${safeInviterName} 様より、Agentest管理者アカウントへの招待が届いています。</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">ロール:</span>
        <span class="info-value">${safeRoleLabel}</span>
      </div>
      <div class="info-row">
        <span class="info-label">有効期限:</span>
        <span class="info-value">${safeExpiresAt}</span>
      </div>
    </div>

    <p>以下のボタンをクリックして、パスワードを設定し、アカウントを有効化してください。</p>

    <div style="text-align: center;">
      <a href="${safeInvitationUrl}" class="button">アカウントを設定する</a>
    </div>

    <p class="note">
      ※このリンクは24時間有効です。期限を過ぎた場合は、管理者に再度招待を依頼してください。<br>
      ※このメールに心当たりがない場合は、無視してください。
    </p>

    <div class="footer">
      <p>Agentest システム管理チーム</p>
    </div>
  </div>
</body>
</html>
`;

    return { subject, text, html };
  }

  /**
   * メールアドレス確認メールを生成
   */
  generateEmailVerificationEmail(params: EmailVerificationEmailParams): EmailContent {
    const { name, verificationUrl, expiresInHours } = params;

    // URLプロトコル検証（javascript: URI等を防止）
    const validatedUrl = sanitizeUrl(verificationUrl);

    const subject = '【Agentest】メールアドレスの確認';

    const text = `${name} 様

Agentestへのご登録ありがとうございます。

以下のURLからメールアドレスの確認を完了してください。

${validatedUrl}

※このリンクは${expiresInHours}時間有効です。期限を過ぎた場合は、再度確認メールをリクエストしてください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このメールに心当たりがない場合は、無視してください。

--
Agentest システム管理チーム
`;

    // XSS防止: HTMLテンプレートに挿入する値をエスケープ
    const safeName = escapeHtml(name);
    const safeVerificationUrl = escapeHtml(validatedUrl);

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>メールアドレスの確認</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #1a1a1a;
    }
    .button {
      display: inline-block;
      background-color: #1a1a1a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: bold;
      margin: 24px 0;
    }
    .button:hover {
      background-color: #333;
    }
    .note {
      font-size: 14px;
      color: #666;
      margin-top: 24px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Agentest</div>
    </div>

    <h1>${safeName} 様</h1>

    <p>Agentestへのご登録ありがとうございます。</p>

    <p>以下のボタンをクリックして、メールアドレスの確認を完了してください。</p>

    <div style="text-align: center;">
      <a href="${safeVerificationUrl}" class="button">メールアドレスを確認する</a>
    </div>

    <p class="note">
      ※このリンクは${expiresInHours}時間有効です。期限を過ぎた場合は、再度確認メールをリクエストしてください。<br>
      ※このメールに心当たりがない場合は、無視してください。
    </p>

    <div class="footer">
      <p>Agentest システム管理チーム</p>
    </div>
  </div>
</body>
</html>
`;

    return { subject, text, html };
  }

  /**
   * パスワードリセットメールを生成
   */
  generatePasswordResetEmail(params: PasswordResetEmailParams): EmailContent {
    const { name, resetUrl, expiresInMinutes } = params;

    // URLプロトコル検証（javascript: URI等を防止）
    const validatedUrl = sanitizeUrl(resetUrl);

    const subject = '【Agentest】パスワードリセット';

    const text = `${name} 様

パスワードリセットのリクエストを受け付けました。

以下のURLからパスワードを再設定してください。

${validatedUrl}

※このリンクは${expiresInMinutes}分間有効です。期限を過ぎた場合は、再度リセットをリクエストしてください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このメールに心当たりがない場合は、無視してください。アカウントのパスワードは変更されません。

--
Agentest システム管理チーム
`;

    // XSS防止: HTMLテンプレートに挿入する値をエスケープ
    const safeName = escapeHtml(name);
    const safeResetUrl = escapeHtml(validatedUrl);

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>パスワードリセット</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #1a1a1a;
    }
    .button {
      display: inline-block;
      background-color: #1a1a1a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: bold;
      margin: 24px 0;
    }
    .button:hover {
      background-color: #333;
    }
    .note {
      font-size: 14px;
      color: #666;
      margin-top: 24px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Agentest</div>
    </div>

    <h1>${safeName} 様</h1>

    <p>パスワードリセットのリクエストを受け付けました。</p>

    <p>以下のボタンをクリックして、パスワードを再設定してください。</p>

    <div style="text-align: center;">
      <a href="${safeResetUrl}" class="button">パスワードを再設定する</a>
    </div>

    <p class="note">
      ※このリンクは${expiresInMinutes}分間有効です。期限を過ぎた場合は、再度リセットをリクエストしてください。<br>
      ※このメールに心当たりがない場合は、無視してください。アカウントのパスワードは変更されません。
    </p>

    <div class="footer">
      <p>Agentest システム管理チーム</p>
    </div>
  </div>
</body>
</html>
`;

    return { subject, text, html };
  }

  /**
   * ウェルカムメール（サインアップ完了通知）を生成
   */
  generateWelcomeEmail(params: WelcomeEmailParams): EmailContent {
    const { name, loginUrl } = params;

    // URLプロトコル検証
    const validatedUrl = sanitizeUrl(loginUrl);

    const subject = '【Agentest】アカウント作成完了 - ようこそ';

    const text = `${name} 様

Agentestへようこそ！アカウントの作成が完了しました。

以下のURLからログインしてご利用ください。

${validatedUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ご不明な点がございましたら、サポートチームまでお問い合わせください。

--
Agentest システム管理チーム
`;

    // XSS防止: HTMLテンプレートに挿入する値をエスケープ
    const safeName = escapeHtml(name);
    const safeLoginUrl = escapeHtml(validatedUrl);

    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>アカウント作成完了</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #1a1a1a;
    }
    .button {
      display: inline-block;
      background-color: #1a1a1a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: bold;
      margin: 24px 0;
    }
    .button:hover {
      background-color: #333;
    }
    .note {
      font-size: 14px;
      color: #666;
      margin-top: 24px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Agentest</div>
    </div>

    <h1>${safeName} 様、ようこそ！</h1>

    <p>Agentestへのアカウント作成が完了しました。</p>

    <p>以下のボタンをクリックしてログインし、ご利用を開始してください。</p>

    <div style="text-align: center;">
      <a href="${safeLoginUrl}" class="button">ログインする</a>
    </div>

    <p class="note">
      ※ご不明な点がございましたら、サポートチームまでお問い合わせください。
    </p>

    <div class="footer">
      <p>Agentest システム管理チーム</p>
    </div>
  </div>
</body>
</html>
`;

    return { subject, text, html };
  }

  /**
   * ロール名を日本語ラベルに変換
   */
  private getRoleLabel(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return '最高権限管理者';
      case 'ADMIN':
        return '一般管理者';
      case 'VIEWER':
        return '閲覧専用';
      default:
        return role;
    }
  }
}

// シングルトンインスタンス
export const emailService = new EmailService();
