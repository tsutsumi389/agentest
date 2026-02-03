import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthConfig } from './types.js';

// passportのモック
const mockPassportUse = vi.hoisted(() => vi.fn());
vi.mock('passport', () => ({
  default: {
    use: mockPassportUse,
  },
}));

// passport-github2のモック
vi.mock('passport-github2', () => ({
  Strategy: vi.fn().mockImplementation((options, callback) => {
    return { name: 'github', options, callback };
  }),
}));

// passport-google-oauth20のモック
vi.mock('passport-google-oauth20', () => ({
  Strategy: vi.fn().mockImplementation((options, callback) => {
    return { name: 'google', options, callback };
  }),
}));

// モック設定後にインポート
import { configurePassport, type OAuthCallback } from './passport.js';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

// テスト用の設定（OAuthあり）
const createTestConfig = (overrides: Partial<AuthConfig['oauth']> = {}): AuthConfig => ({
  jwt: {
    accessSecret: 'test-access-secret',
    refreshSecret: 'test-refresh-secret',
    accessExpiry: '15m',
    refreshExpiry: '7d',
  },
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
  },
  oauth: {
    github: {
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
      callbackUrl: 'http://localhost:3001/auth/github/callback',
    },
    google: {
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      callbackUrl: 'http://localhost:3001/auth/google/callback',
    },
    ...overrides,
  },
});

// ストラテジーモックのヘルパー関数
type StrategyCallback = (
  accessToken: string,
  refreshToken: string,
  profile: Record<string, unknown>,
  done: (error: Error | null, user?: unknown) => void
) => Promise<void>;

function setupStrategyMock(
  StrategyClass: typeof GitHubStrategy | typeof GoogleStrategy,
  strategyName: string
): () => StrategyCallback {
  let capturedCallback: StrategyCallback;
  (StrategyClass as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_options: unknown, callback: StrategyCallback) => {
      capturedCallback = callback;
      return { name: strategyName };
    }
  );
  return () => capturedCallback;
}

describe('passport', () => {
  const mockOnOAuth: OAuthCallback = vi.fn().mockResolvedValue({
    userId: 'user-123',
    email: 'test@example.com',
    profile: {
      provider: 'github',
      providerAccountId: 'provider-123',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configurePassport', () => {
    it('GitHub設定がある場合GitHubStrategyを登録する', () => {
      const config = createTestConfig();

      configurePassport(config, mockOnOAuth);

      expect(GitHubStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientID: 'github-client-id',
          clientSecret: 'github-client-secret',
          callbackURL: 'http://localhost:3001/auth/github/callback',
          scope: ['user:email'],
        }),
        expect.any(Function)
      );
      expect(mockPassportUse).toHaveBeenCalled();
    });

    it('Google設定がある場合GoogleStrategyを登録する', () => {
      const config = createTestConfig();

      configurePassport(config, mockOnOAuth);

      expect(GoogleStrategy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientID: 'google-client-id',
          clientSecret: 'google-client-secret',
          callbackURL: 'http://localhost:3001/auth/google/callback',
          scope: ['profile', 'email'],
        }),
        expect.any(Function)
      );
    });

    it('GitHub設定がない場合GitHubStrategyを登録しない', () => {
      const config = createTestConfig({ github: undefined });

      configurePassport(config, mockOnOAuth);

      expect(GitHubStrategy).not.toHaveBeenCalled();
    });

    it('Google設定がない場合GoogleStrategyを登録しない', () => {
      const config = createTestConfig({ google: undefined });

      configurePassport(config, mockOnOAuth);

      expect(GoogleStrategy).not.toHaveBeenCalled();
    });

    it('両方の設定がない場合どちらも登録しない', () => {
      const config = createTestConfig({ github: undefined, google: undefined });

      configurePassport(config, mockOnOAuth);

      expect(GitHubStrategy).not.toHaveBeenCalled();
      expect(GoogleStrategy).not.toHaveBeenCalled();
      expect(mockPassportUse).not.toHaveBeenCalled();
    });
  });

  describe('GitHub Strategy callback', () => {
    it('GitHubプロファイルからOAuthProfileを構築してコールバックを呼ぶ', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GitHubStrategy, 'github');

      configurePassport(config, mockOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'github-user-123',
        emails: [{ value: 'github@example.com' }],
        displayName: 'GitHub User',
        username: 'githubuser',
        photos: [{ value: 'https://github.com/avatar.jpg' }],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockOnOAuth).toHaveBeenCalledWith({
        provider: 'github',
        providerAccountId: 'github-user-123',
        email: 'github@example.com',
        name: 'GitHub User',
        avatarUrl: 'https://github.com/avatar.jpg',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockDone).toHaveBeenCalledWith(null, expect.any(Object));
    });

    it('メールがない場合はnoreplyアドレスを使用する', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GitHubStrategy, 'github');

      configurePassport(config, mockOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'github-user-123',
        emails: undefined,
        displayName: 'GitHub User',
        username: 'githubuser',
        photos: [],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockOnOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'github-user-123@users.noreply.github.com',
        })
      );
    });

    it('displayNameがない場合はusernameを使用する', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GitHubStrategy, 'github');

      configurePassport(config, mockOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'github-user-123',
        emails: [{ value: 'test@example.com' }],
        displayName: undefined,
        username: 'githubuser',
        photos: [],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockOnOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'githubuser',
        })
      );
    });

    it('displayNameもusernameもない場合はデフォルト名を使用する', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GitHubStrategy, 'github');

      configurePassport(config, mockOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'github-user-123',
        emails: [{ value: 'test@example.com' }],
        displayName: undefined,
        username: undefined,
        photos: [],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockOnOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'GitHub User',
        })
      );
    });

    it('エラーが発生した場合doneにエラーを渡す', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GitHubStrategy, 'github');

      const errorOnOAuth: OAuthCallback = vi.fn().mockRejectedValue(new Error('OAuth failed'));
      configurePassport(config, errorOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'github-user-123',
        emails: [{ value: 'test@example.com' }],
        displayName: 'Test User',
        photos: [],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockDone).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Google Strategy callback', () => {
    it('GoogleプロファイルからOAuthProfileを構築してコールバックを呼ぶ', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GoogleStrategy, 'google');

      configurePassport(config, mockOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'google-user-123',
        emails: [{ value: 'google@example.com' }],
        displayName: 'Google User',
        photos: [{ value: 'https://google.com/avatar.jpg' }],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockOnOAuth).toHaveBeenCalledWith({
        provider: 'google',
        providerAccountId: 'google-user-123',
        email: 'google@example.com',
        name: 'Google User',
        avatarUrl: 'https://google.com/avatar.jpg',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockDone).toHaveBeenCalledWith(null, expect.any(Object));
    });

    it('メールがない場合はエラーをスローする', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GoogleStrategy, 'google');

      configurePassport(config, mockOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'google-user-123',
        emails: undefined,
        displayName: 'Google User',
        photos: [],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockDone).toHaveBeenCalledWith(expect.any(Error));
    });

    it('displayNameがない場合はデフォルト名を使用する', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GoogleStrategy, 'google');

      configurePassport(config, mockOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'google-user-123',
        emails: [{ value: 'test@example.com' }],
        displayName: undefined,
        photos: [],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockOnOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Google User',
        })
      );
    });

    it('エラーが発生した場合doneにエラーを渡す', async () => {
      const config = createTestConfig();
      const getCallback = setupStrategyMock(GoogleStrategy, 'google');

      const errorOnOAuth: OAuthCallback = vi.fn().mockRejectedValue(new Error('OAuth failed'));
      configurePassport(config, errorOnOAuth);

      const callback = getCallback();
      const mockDone = vi.fn();
      const mockProfile = {
        id: 'google-user-123',
        emails: [{ value: 'test@example.com' }],
        displayName: 'Test User',
        photos: [],
      };

      await callback('access-token', 'refresh-token', mockProfile, mockDone);

      expect(mockDone).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
