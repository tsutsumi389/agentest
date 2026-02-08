import { describe, it, expect } from 'vitest';
import {
  passwordSchema,
  userRegisterSchema,
  userLoginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  setPasswordSchema,
  changePasswordSchema,
} from '../schemas.js';

describe('passwordSchema', () => {
  it('8文字以上で大文字・小文字・数字・記号を含むパスワードを受け入れる', () => {
    expect(passwordSchema.safeParse('Test1234!').success).toBe(true);
  });

  it('8文字未満のパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('Te1!');
    expect(result.success).toBe(false);
  });

  it('大文字を含まないパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('test1234!');
    expect(result.success).toBe(false);
  });

  it('小文字を含まないパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('TEST1234!');
    expect(result.success).toBe(false);
  });

  it('数字を含まないパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('TestTest!');
    expect(result.success).toBe(false);
  });

  it('記号を含まないパスワードを拒否する', () => {
    const result = passwordSchema.safeParse('Test1234');
    expect(result.success).toBe(false);
  });

  it('100文字を超えるパスワードを拒否する', () => {
    // 101文字のパスワード（要件を満たす内容だが長すぎる）
    const longPassword = 'Aa1!' + 'x'.repeat(97);
    expect(longPassword.length).toBe(101);
    const result = passwordSchema.safeParse(longPassword);
    expect(result.success).toBe(false);
  });

  it('ちょうど100文字のパスワードを受け入れる', () => {
    const exactPassword = 'Aa1!' + 'x'.repeat(96);
    expect(exactPassword.length).toBe(100);
    const result = passwordSchema.safeParse(exactPassword);
    expect(result.success).toBe(true);
  });
});

describe('userRegisterSchema', () => {
  const validData = {
    email: 'test@example.com',
    password: 'Test1234!',
    name: 'テストユーザー',
  };

  it('有効なデータを受け入れる', () => {
    expect(userRegisterSchema.safeParse(validData).success).toBe(true);
  });

  it('メールアドレスが無効な場合は拒否する', () => {
    expect(userRegisterSchema.safeParse({ ...validData, email: 'invalid' }).success).toBe(false);
  });

  it('名前が空の場合は拒否する', () => {
    expect(userRegisterSchema.safeParse({ ...validData, name: '' }).success).toBe(false);
  });

  it('パスワードが要件を満たさない場合は拒否する', () => {
    expect(userRegisterSchema.safeParse({ ...validData, password: 'weak' }).success).toBe(false);
  });
});

describe('userLoginSchema', () => {
  it('有効なデータを受け入れる', () => {
    expect(userLoginSchema.safeParse({ email: 'test@example.com', password: 'any' }).success).toBe(true);
  });

  it('メールが無効な場合は拒否する', () => {
    expect(userLoginSchema.safeParse({ email: 'invalid', password: 'any' }).success).toBe(false);
  });

  it('パスワードが空の場合は拒否する', () => {
    expect(userLoginSchema.safeParse({ email: 'test@example.com', password: '' }).success).toBe(false);
  });
});

describe('passwordResetRequestSchema', () => {
  it('有効なメールアドレスを受け入れる', () => {
    expect(passwordResetRequestSchema.safeParse({ email: 'test@example.com' }).success).toBe(true);
  });

  it('無効なメールアドレスを拒否する', () => {
    expect(passwordResetRequestSchema.safeParse({ email: 'invalid' }).success).toBe(false);
  });
});

describe('passwordResetSchema', () => {
  it('有効なトークンとパスワードを受け入れる', () => {
    expect(passwordResetSchema.safeParse({ token: 'abc123', password: 'Test1234!' }).success).toBe(true);
  });

  it('トークンが空の場合は拒否する', () => {
    expect(passwordResetSchema.safeParse({ token: '', password: 'Test1234!' }).success).toBe(false);
  });

  it('パスワードが要件を満たさない場合は拒否する', () => {
    expect(passwordResetSchema.safeParse({ token: 'abc123', password: 'weak' }).success).toBe(false);
  });
});

describe('setPasswordSchema', () => {
  it('有効なパスワードを受け入れる', () => {
    expect(setPasswordSchema.safeParse({ password: 'Test1234!' }).success).toBe(true);
  });

  it('弱いパスワードを拒否する', () => {
    expect(setPasswordSchema.safeParse({ password: 'weak' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('有効な現在のパスワードと新しいパスワードを受け入れる', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    }).success).toBe(true);
  });

  it('新しいパスワードが要件を満たさない場合は拒否する', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'OldPass1!',
      newPassword: 'weak',
    }).success).toBe(false);
  });

  it('現在のパスワードが空の場合は拒否する', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'NewPass1!',
    }).success).toBe(false);
  });
});
