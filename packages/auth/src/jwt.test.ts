import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '@agentest/shared';
import {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  getTokenExpiry,
} from './jwt.js';
import type { AuthConfig } from './types.js';

// テスト用の設定
const testConfig: AuthConfig = {
  jwt: {
    accessSecret: 'test-access-secret-12345',
    refreshSecret: 'test-refresh-secret-12345',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
  },
  oauth: {},
};

describe('jwt', () => {
  describe('generateTokens', () => {
    it('アクセストークンとリフレッシュトークンを生成する', () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      const tokens = generateTokens(userId, email, testConfig);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('アクセストークンに正しいペイロードが含まれる', () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      const tokens = generateTokens(userId, email, testConfig);
      const decoded = jwt.decode(tokens.accessToken) as jwt.JwtPayload;

      expect(decoded.sub).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.type).toBe('access');
    });

    it('リフレッシュトークンに正しいペイロードが含まれる', () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      const tokens = generateTokens(userId, email, testConfig);
      const decoded = jwt.decode(tokens.refreshToken) as jwt.JwtPayload;

      expect(decoded.sub).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('verifyAccessToken', () => {
    it('有効なアクセストークンを検証する', () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const tokens = generateTokens(userId, email, testConfig);

      const payload = verifyAccessToken(tokens.accessToken, testConfig);

      expect(payload.sub).toBe(userId);
      expect(payload.email).toBe(email);
      expect(payload.type).toBe('access');
    });

    it('リフレッシュトークンを拒否する', () => {
      const tokens = generateTokens('user-123', 'test@example.com', testConfig);

      // リフレッシュシークレットで署名されているがタイプがrefreshのトークン
      // をアクセストークンとして使おうとする
      const refreshPayload = jwt.decode(tokens.refreshToken) as jwt.JwtPayload;
      const fakeAccessToken = jwt.sign(
        { ...refreshPayload, type: 'refresh' },
        testConfig.jwt.accessSecret
      );

      expect(() => verifyAccessToken(fakeAccessToken, testConfig)).toThrow(AuthenticationError);
      expect(() => verifyAccessToken(fakeAccessToken, testConfig)).toThrow('Invalid token type');
    });

    it('無効なトークンでAuthenticationErrorをスローする', () => {
      expect(() => verifyAccessToken('invalid-token', testConfig)).toThrow(AuthenticationError);
      expect(() => verifyAccessToken('invalid-token', testConfig)).toThrow('Invalid token');
    });

    it('期限切れトークンでAuthenticationErrorをスローする', () => {
      // 期限切れトークンを作成
      const expiredToken = jwt.sign(
        { sub: 'user-123', email: 'test@example.com', type: 'access' },
        testConfig.jwt.accessSecret,
        { expiresIn: '-1s' }
      );

      expect(() => verifyAccessToken(expiredToken, testConfig)).toThrow(AuthenticationError);
      expect(() => verifyAccessToken(expiredToken, testConfig)).toThrow('Token expired');
    });
  });

  describe('verifyRefreshToken', () => {
    it('有効なリフレッシュトークンを検証する', () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const tokens = generateTokens(userId, email, testConfig);

      const payload = verifyRefreshToken(tokens.refreshToken, testConfig);

      expect(payload.sub).toBe(userId);
      expect(payload.email).toBe(email);
      expect(payload.type).toBe('refresh');
    });

    it('アクセストークンを拒否する', () => {
      const tokens = generateTokens('user-123', 'test@example.com', testConfig);

      // アクセストークンをリフレッシュトークンとして使おうとする
      // （シークレットが違うので検証自体失敗するが、仮にシークレットが同じでもtypeで弾かれる）
      const accessPayload = jwt.decode(tokens.accessToken) as jwt.JwtPayload;
      const fakeRefreshToken = jwt.sign(
        { ...accessPayload, type: 'access' },
        testConfig.jwt.refreshSecret
      );

      expect(() => verifyRefreshToken(fakeRefreshToken, testConfig)).toThrow(AuthenticationError);
      expect(() => verifyRefreshToken(fakeRefreshToken, testConfig)).toThrow('Invalid token type');
    });

    it('無効なトークンでAuthenticationErrorをスローする', () => {
      expect(() => verifyRefreshToken('invalid-token', testConfig)).toThrow(AuthenticationError);
      expect(() => verifyRefreshToken('invalid-token', testConfig)).toThrow(
        'Invalid refresh token'
      );
    });

    it('期限切れトークンでAuthenticationErrorをスローする', () => {
      const expiredToken = jwt.sign(
        { sub: 'user-123', email: 'test@example.com', type: 'refresh' },
        testConfig.jwt.refreshSecret,
        { expiresIn: '-1s' }
      );

      expect(() => verifyRefreshToken(expiredToken, testConfig)).toThrow(AuthenticationError);
      expect(() => verifyRefreshToken(expiredToken, testConfig)).toThrow('Refresh token expired');
    });
  });

  describe('decodeToken', () => {
    it('有効なトークンをデコードする', () => {
      const tokens = generateTokens('user-123', 'test@example.com', testConfig);

      const decoded = decodeToken(tokens.accessToken);

      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe('user-123');
      expect(decoded?.email).toBe('test@example.com');
    });

    it('無効なトークンでnullを返す', () => {
      const decoded = decodeToken('not-a-valid-jwt');

      // jwt.decodeは不正な形式でもnullを返すかエラーをスローする
      // 実装ではtry-catchでnullを返す
      expect(decoded).toBeNull();
    });
  });

  describe('getTokenExpiry', () => {
    // 各テストで時刻を固定
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('秒単位の有効期限を計算する', () => {
      const expiry = getTokenExpiry('30s');
      expect(expiry).toEqual(new Date('2024-01-15T12:00:30.000Z'));
    });

    it('分単位の有効期限を計算する', () => {
      const expiry = getTokenExpiry('15m');
      expect(expiry).toEqual(new Date('2024-01-15T12:15:00.000Z'));
    });

    it('時間単位の有効期限を計算する', () => {
      const expiry = getTokenExpiry('2h');
      expect(expiry).toEqual(new Date('2024-01-15T14:00:00.000Z'));
    });

    it('日単位の有効期限を計算する', () => {
      const expiry = getTokenExpiry('7d');
      expect(expiry).toEqual(new Date('2024-01-22T12:00:00.000Z'));
    });

    it('無効な形式でエラーをスローする', () => {
      expect(() => getTokenExpiry('invalid')).toThrow('Invalid expiry format');
      expect(() => getTokenExpiry('15')).toThrow('Invalid expiry format');
      expect(() => getTokenExpiry('m15')).toThrow('Invalid expiry format');
      expect(() => getTokenExpiry('')).toThrow('Invalid expiry format');
    });
  });
});
