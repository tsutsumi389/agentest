import { describe, expect, it } from 'vitest';
import { emailService } from '../email.service.js';

describe('generatePasswordResetEmail', () => {
  const defaultParams = {
    name: 'テスト太郎',
    resetUrl: 'https://example.com/reset?token=abc123',
    expiresInMinutes: 30,
  };

  it('EmailContent（subject, text, html）を返す', () => {
    const result = emailService.generatePasswordResetEmail(defaultParams);

    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('html');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.text).toBe('string');
    expect(typeof result.html).toBe('string');
  });

  it('subjectに「パスワードリセット」が含まれる', () => {
    const result = emailService.generatePasswordResetEmail(defaultParams);

    expect(result.subject).toContain('パスワードリセット');
  });

  it('htmlにリセットURLが含まれる', () => {
    const result = emailService.generatePasswordResetEmail(defaultParams);

    expect(result.html).toContain(defaultParams.resetUrl);
  });

  it('htmlにユーザー名が含まれる', () => {
    const result = emailService.generatePasswordResetEmail(defaultParams);

    expect(result.html).toContain('テスト太郎');
  });

  it('htmlに有効期限の説明が含まれる', () => {
    const result = emailService.generatePasswordResetEmail(defaultParams);

    expect(result.html).toContain('30分');
  });

  it('ユーザー名にHTMLタグが含まれる場合にエスケープされる', () => {
    const params = {
      ...defaultParams,
      name: '<script>alert("xss")</script>',
    };

    const result = emailService.generatePasswordResetEmail(params);

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('リセットURLにjavascript:が含まれる場合にサニタイズされる', () => {
    const params = {
      ...defaultParams,
      resetUrl: 'javascript:alert("xss")',
    };

    expect(() =>
      emailService.generatePasswordResetEmail(params),
    ).toThrow();
  });

  it('textにリセットURL（プレーンテキスト）が含まれる', () => {
    const result = emailService.generatePasswordResetEmail(defaultParams);

    expect(result.text).toContain(defaultParams.resetUrl);
  });
});

describe('generateEmailVerificationEmail', () => {
  const defaultParams = {
    name: 'テスト太郎',
    verificationUrl: 'https://example.com/verify-email?token=abc123',
    expiresInHours: 24,
  };

  it('EmailContent（subject, text, html）を返す', () => {
    const result = emailService.generateEmailVerificationEmail(defaultParams);

    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('html');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.text).toBe('string');
    expect(typeof result.html).toBe('string');
  });

  it('subjectに「メールアドレスの確認」が含まれる', () => {
    const result = emailService.generateEmailVerificationEmail(defaultParams);

    expect(result.subject).toContain('メールアドレスの確認');
  });

  it('htmlに確認URLが含まれる', () => {
    const result = emailService.generateEmailVerificationEmail(defaultParams);

    expect(result.html).toContain(defaultParams.verificationUrl);
  });

  it('htmlにユーザー名が含まれる', () => {
    const result = emailService.generateEmailVerificationEmail(defaultParams);

    expect(result.html).toContain('テスト太郎');
  });

  it('htmlに有効期限の説明が含まれる', () => {
    const result = emailService.generateEmailVerificationEmail(defaultParams);

    expect(result.html).toContain('24時間');
  });

  it('ユーザー名にHTMLタグが含まれる場合にエスケープされる', () => {
    const params = {
      ...defaultParams,
      name: '<script>alert("xss")</script>',
    };

    const result = emailService.generateEmailVerificationEmail(params);

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('確認URLにjavascript:が含まれる場合にサニタイズされる', () => {
    const params = {
      ...defaultParams,
      verificationUrl: 'javascript:alert("xss")',
    };

    expect(() =>
      emailService.generateEmailVerificationEmail(params),
    ).toThrow();
  });

  it('textに確認URL（プレーンテキスト）が含まれる', () => {
    const result = emailService.generateEmailVerificationEmail(defaultParams);

    expect(result.text).toContain(defaultParams.verificationUrl);
  });
});

describe('generateWelcomeEmail', () => {
  const defaultParams = {
    name: 'テスト太郎',
    loginUrl: 'https://example.com/login',
  };

  it('EmailContent（subject, text, html）を返す', () => {
    const result = emailService.generateWelcomeEmail(defaultParams);

    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('html');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.text).toBe('string');
    expect(typeof result.html).toBe('string');
  });

  it('subjectに「ようこそ」または「アカウント作成」が含まれる', () => {
    const result = emailService.generateWelcomeEmail(defaultParams);

    const hasExpectedSubject =
      result.subject.includes('ようこそ') ||
      result.subject.includes('アカウント作成');

    expect(hasExpectedSubject).toBe(true);
  });

  it('htmlにユーザー名が含まれる', () => {
    const result = emailService.generateWelcomeEmail(defaultParams);

    expect(result.html).toContain('テスト太郎');
  });

  it('htmlにログインURLが含まれる', () => {
    const result = emailService.generateWelcomeEmail(defaultParams);

    expect(result.html).toContain(defaultParams.loginUrl);
  });

  it('ユーザー名にHTMLタグが含まれる場合にエスケープされる', () => {
    const params = {
      ...defaultParams,
      name: '<img src=x onerror=alert(1)>',
    };

    const result = emailService.generateWelcomeEmail(params);

    expect(result.html).not.toContain('<img');
    expect(result.html).toContain('&lt;img');
  });

  it('ログインURLにjavascript:が含まれる場合にサニタイズされる', () => {
    const params = {
      ...defaultParams,
      loginUrl: 'javascript:alert("xss")',
    };

    expect(() =>
      emailService.generateWelcomeEmail(params),
    ).toThrow();
  });
});
