import { describe, it, expect, vi, beforeEach } from 'vitest';

// Redisモック
const mockRedis = vi.hoisted(() => ({
  setex: vi.fn().mockResolvedValue('OK'),
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn(),
  scan: vi.fn().mockResolvedValue(['0', []]),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => mockRedis),
}));

// envモック
const mockEnv = vi.hoisted(() => ({
  REDIS_URL: 'redis://localhost:6379',
  NODE_ENV: 'development',
}));

vi.mock('../../config/env.js', () => ({
  env: mockEnv,
}));

import {
  getRedisClient,
  setTotpSetupSecret,
  getTotpSetupSecret,
  deleteTotpSetupSecret,
  markTotpCodeUsed,
  isTotpCodeUsed,
  closeRedisStore,
  setAdminDashboardCache,
  getAdminDashboardCache,
  invalidateAdminDashboardCache,
  setAdminUsersCache,
  getAdminUsersCache,
  getAdminUserDetailCache,
  setAdminUserDetailCache,
  invalidateAdminUserDetailCache,
  setAdminOrganizationsCache,
  getAdminOrganizationsCache,
  invalidateAdminOrganizationsCache,
  getAdminOrganizationDetailCache,
  setAdminOrganizationDetailCache,
  invalidateAdminOrganizationDetailCache,
  setAdminAuditLogsCache,
  getAdminAuditLogsCache,
  setSystemAdminsCache,
  getSystemAdminsCache,
  invalidateSystemAdminsCache,
  getSystemAdminDetailCache,
  setSystemAdminDetailCache,
  invalidateSystemAdminDetailCache,
  setUserTotpSetupSecret,
  getUserTotpSetupSecret,
  deleteUserTotpSetupSecret,
  markUserTotpCodeUsed,
  isUserTotpCodeUsed,
  setUserTwoFactorToken,
  getUserIdByTwoFactorToken,
  deleteUserTwoFactorToken,
} from '../../lib/redis-store.js';

const TEST_ADMIN_USER_ID = 'admin-user-1';
const TEST_USER_ID = 'user-1';
const TEST_ORG_ID = 'org-1';

describe('redis-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.REDIS_URL = 'redis://localhost:6379';
    mockEnv.NODE_ENV = 'development';
  });

  // ===========================================
  // getRedisClient
  // ===========================================
  describe('getRedisClient', () => {
    it('REDIS_URL設定時にRedisクライアントを返す', () => {
      const client = getRedisClient();
      expect(client).toBeDefined();
      expect(client).not.toBeNull();
    });

    it('REDIS_URL未設定時にnullを返す', () => {
      mockEnv.REDIS_URL = '';
      const client = getRedisClient();
      expect(client).toBeNull();
    });
  });

  // ===========================================
  // TOTP関連
  // ===========================================
  describe('TOTP操作', () => {
    describe('setTotpSetupSecret', () => {
      it('秘密鍵を保存できる', async () => {
        const result = await setTotpSetupSecret(TEST_ADMIN_USER_ID, 'secret123');
        expect(result).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `totp:setup:${TEST_ADMIN_USER_ID}`,
          300,
          'secret123'
        );
      });

      it('カスタムTTLを指定できる', async () => {
        await setTotpSetupSecret(TEST_ADMIN_USER_ID, 'secret', 600);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `totp:setup:${TEST_ADMIN_USER_ID}`,
          600,
          'secret'
        );
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await setTotpSetupSecret(TEST_ADMIN_USER_ID, 'secret');
        expect(result).toBe(false);
      });

      it('Redisエラー時はfalseを返す', async () => {
        mockRedis.setex.mockRejectedValueOnce(new Error('Redis error'));
        const result = await setTotpSetupSecret(TEST_ADMIN_USER_ID, 'secret');
        expect(result).toBe(false);
      });
    });

    describe('getTotpSetupSecret', () => {
      it('秘密鍵を取得できる', async () => {
        mockRedis.get.mockResolvedValue('secret123');
        const result = await getTotpSetupSecret(TEST_ADMIN_USER_ID);
        expect(result).toBe('secret123');
      });

      it('存在しない場合はnullを返す', async () => {
        mockRedis.get.mockResolvedValue(null);
        const result = await getTotpSetupSecret(TEST_ADMIN_USER_ID);
        expect(result).toBeNull();
      });

      it('Redis未設定時はnullを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await getTotpSetupSecret(TEST_ADMIN_USER_ID);
        expect(result).toBeNull();
      });

      it('Redisエラー時はnullを返す', async () => {
        mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));
        const result = await getTotpSetupSecret(TEST_ADMIN_USER_ID);
        expect(result).toBeNull();
      });
    });

    describe('deleteTotpSetupSecret', () => {
      it('秘密鍵を削除できる', async () => {
        const result = await deleteTotpSetupSecret(TEST_ADMIN_USER_ID);
        expect(result).toBe(true);
        expect(mockRedis.del).toHaveBeenCalledWith(`totp:setup:${TEST_ADMIN_USER_ID}`);
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await deleteTotpSetupSecret(TEST_ADMIN_USER_ID);
        expect(result).toBe(false);
      });
    });

    describe('markTotpCodeUsed', () => {
      it('コードを使用済みマークできる', async () => {
        const result = await markTotpCodeUsed(TEST_ADMIN_USER_ID, '123456');
        expect(result).toBe(true);
        expect(mockRedis.set).toHaveBeenCalledWith(
          `totp:used:${TEST_ADMIN_USER_ID}:123456`,
          '1',
          'EX',
          90,
          'NX'
        );
      });

      it('既に使用済みの場合はfalseを返す', async () => {
        mockRedis.set.mockResolvedValueOnce(null); // NXでキーが既に存在
        const result = await markTotpCodeUsed(TEST_ADMIN_USER_ID, '123456');
        expect(result).toBe(false);
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await markTotpCodeUsed(TEST_ADMIN_USER_ID, '123456');
        expect(result).toBe(false);
      });
    });

    describe('isTotpCodeUsed', () => {
      it('使用済みコードの場合trueを返す', async () => {
        mockRedis.exists.mockResolvedValue(1);
        const result = await isTotpCodeUsed(TEST_ADMIN_USER_ID, '123456');
        expect(result).toBe(true);
      });

      it('未使用コードの場合falseを返す', async () => {
        mockRedis.exists.mockResolvedValue(0);
        const result = await isTotpCodeUsed(TEST_ADMIN_USER_ID, '123456');
        expect(result).toBe(false);
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await isTotpCodeUsed(TEST_ADMIN_USER_ID, '123456');
        expect(result).toBe(false);
      });
    });
  });

  // ===========================================
  // 管理者ダッシュボードキャッシュ
  // ===========================================
  describe('管理者ダッシュボードキャッシュ', () => {
    it('統計を保存・取得できる', async () => {
      const stats = { users: 100, projects: 50 };
      await setAdminDashboardCache(stats);
      expect(mockRedis.setex).toHaveBeenCalledWith('admin:dashboard', 300, JSON.stringify(stats));
    });

    it('キャッシュを取得できる', async () => {
      const stats = { users: 100 };
      mockRedis.get.mockResolvedValue(JSON.stringify(stats));
      const result = await getAdminDashboardCache();
      expect(result).toEqual(stats);
    });

    it('キャッシュが存在しない場合はnullを返す', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await getAdminDashboardCache();
      expect(result).toBeNull();
    });

    it('キャッシュを無効化できる', async () => {
      const result = await invalidateAdminDashboardCache();
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('admin:dashboard');
    });

    it('Redis未設定時はfalse/nullを返す', async () => {
      mockEnv.REDIS_URL = '';
      expect(await setAdminDashboardCache({ test: true })).toBe(false);
      expect(await getAdminDashboardCache()).toBeNull();
      expect(await invalidateAdminDashboardCache()).toBe(false);
    });
  });

  // ===========================================
  // パラメトリックキーによるキャッシュ（ユーザー一覧）
  // ===========================================
  describe('管理者ユーザー一覧キャッシュ', () => {
    it('パラメータからキーを生成して保存する', async () => {
      const params = { page: 1, limit: 10 };
      const data = { items: [], total: 0 };
      await setAdminUsersCache(params, data);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('admin:users:'),
        60,
        JSON.stringify(data)
      );
    });

    it('同じパラメータで取得できる', async () => {
      const data = { items: [{ id: '1' }], total: 1 };
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      const result = await getAdminUsersCache({ page: 1, limit: 10 });
      expect(result).toEqual(data);
    });

    it('パラメータの順序に依存しない（ソート済み）', async () => {
      await setAdminUsersCache({ limit: 10, page: 1 }, { test: true });
      const call1Key = mockRedis.setex.mock.calls[0][0];

      vi.clearAllMocks();
      await setAdminUsersCache({ page: 1, limit: 10 }, { test: true });
      const call2Key = mockRedis.setex.mock.calls[0][0];

      expect(call1Key).toBe(call2Key);
    });

    it('undefinedとnullのパラメータはフィルタされる', async () => {
      await setAdminUsersCache({ page: 1, search: undefined, filter: null }, {});
      const key = mockRedis.setex.mock.calls[0][0];
      expect(key).not.toContain('search');
      expect(key).not.toContain('filter');
    });
  });

  // ===========================================
  // 管理者ユーザー詳細キャッシュ
  // ===========================================
  describe('管理者ユーザー詳細キャッシュ', () => {
    it('ユーザー詳細を保存・取得・無効化できる', async () => {
      const data = { id: TEST_USER_ID, name: 'User' };
      await setAdminUserDetailCache(TEST_USER_ID, data);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `admin:user:detail:${TEST_USER_ID}`,
        30,
        JSON.stringify(data)
      );

      mockRedis.get.mockResolvedValue(JSON.stringify(data));
      const result = await getAdminUserDetailCache(TEST_USER_ID);
      expect(result).toEqual(data);

      await invalidateAdminUserDetailCache(TEST_USER_ID);
      expect(mockRedis.del).toHaveBeenCalledWith(`admin:user:detail:${TEST_USER_ID}`);
    });
  });

  // ===========================================
  // 管理者組織キャッシュ
  // ===========================================
  describe('管理者組織一覧キャッシュ', () => {
    it('組織一覧を保存・取得できる', async () => {
      const data = { items: [] };
      await setAdminOrganizationsCache({ page: 1 }, data);
      expect(mockRedis.setex).toHaveBeenCalled();

      mockRedis.get.mockResolvedValue(JSON.stringify(data));
      const result = await getAdminOrganizationsCache({ page: 1 });
      expect(result).toEqual(data);
    });

    it('SCANでパターンマッチし全キャッシュを無効化する', async () => {
      mockRedis.scan.mockResolvedValue([
        '0',
        ['admin:organizations:key1', 'admin:organizations:key2'],
      ]);
      const result = await invalidateAdminOrganizationsCache();
      expect(result).toBe(true);
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'admin:organizations:*',
        'COUNT',
        100
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'admin:organizations:key1',
        'admin:organizations:key2'
      );
    });

    it('SCANが複数イテレーションに分かれる場合も全キーを収集して削除する', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['5', ['admin:organizations:key1']])
        .mockResolvedValueOnce(['0', ['admin:organizations:key2']]);
      const result = await invalidateAdminOrganizationsCache();
      expect(result).toBe(true);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'admin:organizations:*',
        'COUNT',
        100
      );
      expect(mockRedis.scan).toHaveBeenNthCalledWith(
        2,
        '5',
        'MATCH',
        'admin:organizations:*',
        'COUNT',
        100
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'admin:organizations:key1',
        'admin:organizations:key2'
      );
    });

    it('キャッシュキーが0件の場合はdelを呼ばない', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      await invalidateAdminOrganizationsCache();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // 管理者組織詳細キャッシュ
  // ===========================================
  describe('管理者組織詳細キャッシュ', () => {
    it('組織詳細を保存・取得・無効化できる', async () => {
      const data = { id: TEST_ORG_ID, name: 'Org' };
      await setAdminOrganizationDetailCache(TEST_ORG_ID, data);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `admin:organization:detail:${TEST_ORG_ID}`,
        30,
        JSON.stringify(data)
      );

      mockRedis.get.mockResolvedValue(JSON.stringify(data));
      const result = await getAdminOrganizationDetailCache(TEST_ORG_ID);
      expect(result).toEqual(data);

      await invalidateAdminOrganizationDetailCache(TEST_ORG_ID);
      expect(mockRedis.del).toHaveBeenCalledWith(`admin:organization:detail:${TEST_ORG_ID}`);
    });
  });

  // ===========================================
  // 監査ログキャッシュ
  // ===========================================
  describe('管理者監査ログキャッシュ', () => {
    it('パラメトリックキーで保存・取得できる', async () => {
      const data = { items: [], total: 0 };
      await setAdminAuditLogsCache({ page: 1 }, data);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('admin:audit-logs:'),
        30,
        JSON.stringify(data)
      );

      mockRedis.get.mockResolvedValue(JSON.stringify(data));
      const result = await getAdminAuditLogsCache({ page: 1 });
      expect(result).toEqual(data);
    });
  });

  // ===========================================
  // システム管理者キャッシュ
  // ===========================================
  describe('システム管理者一覧キャッシュ', () => {
    it('パラメトリックキーで保存・取得できる', async () => {
      const data = { items: [{ id: 'admin-1' }] };
      await setSystemAdminsCache({ page: 1 }, data);
      expect(mockRedis.setex).toHaveBeenCalled();

      mockRedis.get.mockResolvedValue(JSON.stringify(data));
      const result = await getSystemAdminsCache({ page: 1 });
      expect(result).toEqual(data);
    });

    it('SCANでパターンマッチし全キャッシュを無効化する', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['admin:system-admins:key1']]);
      await invalidateSystemAdminsCache();
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'admin:system-admins:*',
        'COUNT',
        100
      );
    });
  });

  describe('システム管理者詳細キャッシュ', () => {
    it('保存・取得・無効化できる', async () => {
      const data = { id: TEST_ADMIN_USER_ID, name: 'Admin' };
      await setSystemAdminDetailCache(TEST_ADMIN_USER_ID, data);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `admin:system-admin:detail:${TEST_ADMIN_USER_ID}`,
        30,
        JSON.stringify(data)
      );

      mockRedis.get.mockResolvedValue(JSON.stringify(data));
      expect(await getSystemAdminDetailCache(TEST_ADMIN_USER_ID)).toEqual(data);

      await invalidateSystemAdminDetailCache(TEST_ADMIN_USER_ID);
      expect(mockRedis.del).toHaveBeenCalledWith(`admin:system-admin:detail:${TEST_ADMIN_USER_ID}`);
    });
  });

  // ===========================================
  // closeRedisStore
  // ===========================================
  describe('closeRedisStore', () => {
    it('Redis接続を閉じる', async () => {
      // getRedisClientを呼んで初期化
      getRedisClient();
      await closeRedisStore();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  // ===========================================
  // ユーザーTOTP関連
  // ===========================================
  describe('ユーザーTOTP操作', () => {
    // セットアップ用一時秘密鍵
    describe('setUserTotpSetupSecret', () => {
      it('秘密鍵を保存できる', async () => {
        const result = await setUserTotpSetupSecret(TEST_USER_ID, 'user-secret123');
        expect(result).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `user:totp:setup:${TEST_USER_ID}`,
          300,
          'user-secret123'
        );
      });

      it('カスタムTTLを指定できる', async () => {
        await setUserTotpSetupSecret(TEST_USER_ID, 'secret', 600);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `user:totp:setup:${TEST_USER_ID}`,
          600,
          'secret'
        );
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await setUserTotpSetupSecret(TEST_USER_ID, 'secret');
        expect(result).toBe(false);
      });

      it('Redisエラー時はfalseを返す', async () => {
        mockRedis.setex.mockRejectedValueOnce(new Error('Redis error'));
        const result = await setUserTotpSetupSecret(TEST_USER_ID, 'secret');
        expect(result).toBe(false);
      });
    });

    describe('getUserTotpSetupSecret', () => {
      it('秘密鍵を取得できる', async () => {
        mockRedis.get.mockResolvedValue('user-secret123');
        const result = await getUserTotpSetupSecret(TEST_USER_ID);
        expect(result).toBe('user-secret123');
        expect(mockRedis.get).toHaveBeenCalledWith(`user:totp:setup:${TEST_USER_ID}`);
      });

      it('存在しない場合はnullを返す', async () => {
        mockRedis.get.mockResolvedValue(null);
        const result = await getUserTotpSetupSecret(TEST_USER_ID);
        expect(result).toBeNull();
      });

      it('Redis未設定時はnullを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await getUserTotpSetupSecret(TEST_USER_ID);
        expect(result).toBeNull();
      });

      it('Redisエラー時はnullを返す', async () => {
        mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));
        const result = await getUserTotpSetupSecret(TEST_USER_ID);
        expect(result).toBeNull();
      });
    });

    describe('deleteUserTotpSetupSecret', () => {
      it('秘密鍵を削除できる', async () => {
        const result = await deleteUserTotpSetupSecret(TEST_USER_ID);
        expect(result).toBe(true);
        expect(mockRedis.del).toHaveBeenCalledWith(`user:totp:setup:${TEST_USER_ID}`);
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await deleteUserTotpSetupSecret(TEST_USER_ID);
        expect(result).toBe(false);
      });

      it('Redisエラー時はfalseを返す', async () => {
        mockRedis.del.mockRejectedValueOnce(new Error('Redis error'));
        const result = await deleteUserTotpSetupSecret(TEST_USER_ID);
        expect(result).toBe(false);
      });
    });

    // リプレイ攻撃対策
    describe('markUserTotpCodeUsed', () => {
      it('コードを使用済みマークできる', async () => {
        const result = await markUserTotpCodeUsed(TEST_USER_ID, '654321');
        expect(result).toBe(true);
        expect(mockRedis.set).toHaveBeenCalledWith(
          `user:totp:used:${TEST_USER_ID}:654321`,
          '1',
          'EX',
          90,
          'NX'
        );
      });

      it('カスタムTTLを指定できる', async () => {
        await markUserTotpCodeUsed(TEST_USER_ID, '654321', 120);
        expect(mockRedis.set).toHaveBeenCalledWith(
          `user:totp:used:${TEST_USER_ID}:654321`,
          '1',
          'EX',
          120,
          'NX'
        );
      });

      it('既に使用済みの場合はfalseを返す', async () => {
        mockRedis.set.mockResolvedValueOnce(null);
        const result = await markUserTotpCodeUsed(TEST_USER_ID, '654321');
        expect(result).toBe(false);
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await markUserTotpCodeUsed(TEST_USER_ID, '654321');
        expect(result).toBe(false);
      });

      it('Redisエラー時はfalseを返す', async () => {
        mockRedis.set.mockRejectedValueOnce(new Error('Redis error'));
        const result = await markUserTotpCodeUsed(TEST_USER_ID, '654321');
        expect(result).toBe(false);
      });
    });

    describe('isUserTotpCodeUsed', () => {
      it('使用済みコードの場合trueを返す', async () => {
        mockRedis.exists.mockResolvedValue(1);
        const result = await isUserTotpCodeUsed(TEST_USER_ID, '654321');
        expect(result).toBe(true);
        expect(mockRedis.exists).toHaveBeenCalledWith(`user:totp:used:${TEST_USER_ID}:654321`);
      });

      it('未使用コードの場合falseを返す', async () => {
        mockRedis.exists.mockResolvedValue(0);
        const result = await isUserTotpCodeUsed(TEST_USER_ID, '654321');
        expect(result).toBe(false);
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await isUserTotpCodeUsed(TEST_USER_ID, '654321');
        expect(result).toBe(false);
      });

      it('Redisエラー時はfalseを返す', async () => {
        mockRedis.exists.mockRejectedValueOnce(new Error('Redis error'));
        const result = await isUserTotpCodeUsed(TEST_USER_ID, '654321');
        expect(result).toBe(false);
      });
    });

    // 2FA認証用一時トークン
    describe('setUserTwoFactorToken', () => {
      it('一時トークンを保存できる', async () => {
        const result = await setUserTwoFactorToken(TEST_USER_ID, 'token-abc123');
        expect(result).toBe(true);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `user:2fa:token:token-abc123`,
          300,
          TEST_USER_ID
        );
      });

      it('カスタムTTLを指定できる', async () => {
        await setUserTwoFactorToken(TEST_USER_ID, 'token-abc123', 600);
        expect(mockRedis.setex).toHaveBeenCalledWith(
          `user:2fa:token:token-abc123`,
          600,
          TEST_USER_ID
        );
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await setUserTwoFactorToken(TEST_USER_ID, 'token-abc123');
        expect(result).toBe(false);
      });

      it('Redisエラー時はfalseを返す', async () => {
        mockRedis.setex.mockRejectedValueOnce(new Error('Redis error'));
        const result = await setUserTwoFactorToken(TEST_USER_ID, 'token-abc123');
        expect(result).toBe(false);
      });
    });

    describe('getUserIdByTwoFactorToken', () => {
      it('トークンからユーザーIDを取得できる', async () => {
        mockRedis.get.mockResolvedValue(TEST_USER_ID);
        const result = await getUserIdByTwoFactorToken('token-abc123');
        expect(result).toBe(TEST_USER_ID);
        expect(mockRedis.get).toHaveBeenCalledWith('user:2fa:token:token-abc123');
      });

      it('存在しない場合はnullを返す', async () => {
        mockRedis.get.mockResolvedValue(null);
        const result = await getUserIdByTwoFactorToken('expired-token');
        expect(result).toBeNull();
      });

      it('Redis未設定時はnullを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await getUserIdByTwoFactorToken('token-abc123');
        expect(result).toBeNull();
      });

      it('Redisエラー時はnullを返す', async () => {
        mockRedis.get.mockRejectedValueOnce(new Error('Redis error'));
        const result = await getUserIdByTwoFactorToken('token-abc123');
        expect(result).toBeNull();
      });
    });

    describe('deleteUserTwoFactorToken', () => {
      it('一時トークンを削除できる', async () => {
        const result = await deleteUserTwoFactorToken('token-abc123');
        expect(result).toBe(true);
        expect(mockRedis.del).toHaveBeenCalledWith('user:2fa:token:token-abc123');
      });

      it('Redis未設定時はfalseを返す', async () => {
        mockEnv.REDIS_URL = '';
        const result = await deleteUserTwoFactorToken('token-abc123');
        expect(result).toBe(false);
      });

      it('Redisエラー時はfalseを返す', async () => {
        mockRedis.del.mockRejectedValueOnce(new Error('Redis error'));
        const result = await deleteUserTwoFactorToken('token-abc123');
        expect(result).toBe(false);
      });
    });
  });

  // ===========================================
  // エラーハンドリング（汎用）
  // ===========================================
  describe('エラーハンドリング', () => {
    it('set操作でRedisエラー時はfalseを返す', async () => {
      mockRedis.setex.mockRejectedValueOnce(new Error('connection error'));
      const result = await setAdminDashboardCache({ test: true });
      expect(result).toBe(false);
    });

    it('get操作でRedisエラー時はnullを返す', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('connection error'));
      const result = await getAdminDashboardCache();
      expect(result).toBeNull();
    });

    it('invalidate操作でRedisエラー時はfalseを返す', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('connection error'));
      const result = await invalidateAdminDashboardCache();
      expect(result).toBe(false);
    });

    it('get操作でJSON parseエラー時はnullを返す', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');
      const result = await getAdminDashboardCache();
      expect(result).toBeNull();
    });

    it('パターンマッチ無効化でRedisエラー時はfalseを返す', async () => {
      mockRedis.scan.mockRejectedValueOnce(new Error('connection error'));
      const result = await invalidateAdminOrganizationsCache();
      expect(result).toBe(false);
    });
  });
});
