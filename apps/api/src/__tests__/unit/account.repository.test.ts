import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountRepository } from '../../repositories/account.repository.js';
import { encrypt } from '../../utils/crypto.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaAccount = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    account: mockPrismaAccount,
  },
}));

// 環境変数のモック
vi.mock('../../config/env.js', () => ({
  env: {
    TOKEN_ENCRYPTION_KEY: 'test-encryption-key-for-unit-tests-32ch',
  },
}));

// ロガーのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn(), child: vi.fn() };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../../utils/logger.js', () => ({ logger: mockLogger }));

const TEST_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-32ch';

describe('AccountRepository', () => {
  let repository: AccountRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AccountRepository();
  });

  describe('findByUserId', () => {
    it('ユーザーのOAuth連携一覧を取得できる', async () => {
      const mockAccounts = [
        {
          id: 'account-1',
          provider: 'github',
          providerAccountId: 'github-123',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'account-2',
          provider: 'google',
          providerAccountId: 'google-456',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];
      mockPrismaAccount.findMany.mockResolvedValue(mockAccounts);

      const result = await repository.findByUserId('user-1');

      expect(mockPrismaAccount.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: {
          id: true,
          provider: true,
          providerAccountId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(mockAccounts);
    });

    it('作成日時順でソートされる', async () => {
      const mockAccounts = [
        {
          id: 'account-1',
          provider: 'github',
          providerAccountId: 'github-123',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];
      mockPrismaAccount.findMany.mockResolvedValue(mockAccounts);

      await repository.findByUserId('user-1');

      expect(mockPrismaAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('連携がない場合は空配列を返す', async () => {
      mockPrismaAccount.findMany.mockResolvedValue([]);

      const result = await repository.findByUserId('user-no-accounts');

      expect(result).toEqual([]);
    });
  });

  describe('findByUserIdAndProvider', () => {
    it('特定プロバイダーの連携を取得できる', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'github-123',
        accessToken: null,
        refreshToken: null,
      };
      mockPrismaAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByUserIdAndProvider('user-1', 'github');

      expect(mockPrismaAccount.findUnique).toHaveBeenCalledWith({
        where: {
          userId_provider: { userId: 'user-1', provider: 'github' },
        },
      });
      expect(result).toEqual(mockAccount);
    });

    it('暗号化されたトークンを復号して返す', async () => {
      const encryptedAccess = encrypt('gho_abc123', TEST_ENCRYPTION_KEY);
      const encryptedRefresh = encrypt('ghr_def456', TEST_ENCRYPTION_KEY);
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'github-123',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
      };
      mockPrismaAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByUserIdAndProvider('user-1', 'github');

      expect(result?.accessToken).toBe('gho_abc123');
      expect(result?.refreshToken).toBe('ghr_def456');
    });

    it('トークンがnullの場合はnullのまま返す', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'github-123',
        accessToken: null,
        refreshToken: null,
      };
      mockPrismaAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByUserIdAndProvider('user-1', 'github');

      expect(result?.accessToken).toBeNull();
      expect(result?.refreshToken).toBeNull();
    });

    it('存在しない組み合わせはnullを返す', async () => {
      mockPrismaAccount.findUnique.mockResolvedValue(null);

      const result = await repository.findByUserIdAndProvider('user-1', 'twitter');

      expect(result).toBeNull();
    });
  });

  describe('countByUserId', () => {
    it('連携数をカウントできる', async () => {
      mockPrismaAccount.count.mockResolvedValue(3);

      const result = await repository.countByUserId('user-1');

      expect(mockPrismaAccount.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toBe(3);
    });

    it('連携がない場合は0を返す', async () => {
      mockPrismaAccount.count.mockResolvedValue(0);

      const result = await repository.countByUserId('user-no-accounts');

      expect(result).toBe(0);
    });
  });

  describe('delete', () => {
    it('連携を削除できる', async () => {
      const mockDeletedAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
      };
      mockPrismaAccount.delete.mockResolvedValue(mockDeletedAccount);

      const result = await repository.delete('account-1');

      expect(mockPrismaAccount.delete).toHaveBeenCalledWith({
        where: { id: 'account-1' },
      });
      expect(result).toEqual(mockDeletedAccount);
    });
  });

  describe('findByProviderAccountId', () => {
    it('プロバイダーとアカウントIDで連携を検索できる', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'github-123',
        accessToken: null,
        refreshToken: null,
      };
      mockPrismaAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByProviderAccountId('github', 'github-123');

      expect(mockPrismaAccount.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerAccountId: { provider: 'github', providerAccountId: 'github-123' },
        },
      });
      expect(result).toEqual(mockAccount);
    });

    it('暗号化されたトークンを復号して返す', async () => {
      const encryptedAccess = encrypt('gho_xyz789', TEST_ENCRYPTION_KEY);
      const encryptedRefresh = encrypt('ghr_uvw012', TEST_ENCRYPTION_KEY);
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'github-123',
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
      };
      mockPrismaAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByProviderAccountId('github', 'github-123');

      expect(result?.accessToken).toBe('gho_xyz789');
      expect(result?.refreshToken).toBe('ghr_uvw012');
    });

    it('存在しない場合はnullを返す', async () => {
      mockPrismaAccount.findUnique.mockResolvedValue(null);

      const result = await repository.findByProviderAccountId('github', 'non-existent');

      expect(result).toBeNull();
    });

    it('平文トークン（既存データ）はそのまま返す', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'github-123',
        accessToken: 'gho_plaintext_token',
        refreshToken: 'ghr_plaintext_token',
      };
      mockPrismaAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByProviderAccountId('github', 'github-123');

      expect(result?.accessToken).toBe('gho_plaintext_token');
      expect(result?.refreshToken).toBe('ghr_plaintext_token');
    });
  });

  describe('decryptAccountTokens エラーハンドリング', () => {
    it('accessTokenの復号に失敗した場合、accessTokenはnullだがrefreshTokenは復号される', async () => {
      // accessToken: 異なるキーで暗号化（復号不能）
      const encryptedWithDifferentKey = encrypt('secret', 'completely-different-key-for-testing');
      // refreshToken: 正しいキーで暗号化（復号可能）
      const encryptedRefresh = encrypt('valid-refresh', TEST_ENCRYPTION_KEY);
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'github-123',
        accessToken: encryptedWithDifferentKey,
        refreshToken: encryptedRefresh,
      };
      mockPrismaAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByProviderAccountId('github', 'github-123');

      // accessTokenは復号失敗でnull
      expect(result?.accessToken).toBeNull();
      // refreshTokenは独立して復号成功
      expect(result?.refreshToken).toBe('valid-refresh');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'account-1' }),
        'accessTokenの復号に失敗（データ改ざんまたはキー不整合の可能性）'
      );
    });

    it('両方のトークンの復号に失敗した場合は両方nullを返す', async () => {
      const encryptedWithDifferentKey = encrypt('secret', 'completely-different-key-for-testing');
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        provider: 'github',
        providerAccountId: 'github-123',
        accessToken: encryptedWithDifferentKey,
        refreshToken: encryptedWithDifferentKey,
      };
      mockPrismaAccount.findUnique.mockResolvedValue(mockAccount);

      const result = await repository.findByProviderAccountId('github', 'github-123');

      expect(result?.accessToken).toBeNull();
      expect(result?.refreshToken).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });
});
