import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService } from '../../services/account.service.js';
import { NotFoundError, ValidationError } from '@agentest/shared';

// AccountRepository のモック
const mockAccountRepo = {
  findByUserId: vi.fn(),
  findByUserIdAndProvider: vi.fn(),
  countByUserId: vi.fn(),
  delete: vi.fn(),
  findByProviderAccountId: vi.fn(),
};

vi.mock('../../repositories/account.repository.js', () => ({
  AccountRepository: vi.fn().mockImplementation(() => mockAccountRepo),
}));

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountService();
  });

  describe('getAccounts', () => {
    it('ユーザーのOAuth連携一覧を取得できる', async () => {
      const mockAccounts = [
        {
          id: '1',
          provider: 'github',
          providerAccountId: 'gh123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          provider: 'google',
          providerAccountId: 'go456',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockAccountRepo.findByUserId.mockResolvedValue(mockAccounts);

      const result = await service.getAccounts('user-1');

      expect(mockAccountRepo.findByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('getAccountByProvider', () => {
    it('特定のプロバイダー連携を取得できる', async () => {
      const mockAccount = { id: '1', provider: 'github', providerAccountId: 'gh123' };
      mockAccountRepo.findByUserIdAndProvider.mockResolvedValue(mockAccount);

      const result = await service.getAccountByProvider('user-1', 'github');

      expect(mockAccountRepo.findByUserIdAndProvider).toHaveBeenCalledWith('user-1', 'github');
      expect(result).toEqual(mockAccount);
    });

    it('連携が存在しない場合はNotFoundErrorを投げる', async () => {
      mockAccountRepo.findByUserIdAndProvider.mockResolvedValue(null);

      await expect(service.getAccountByProvider('user-1', 'github')).rejects.toThrow(NotFoundError);
    });
  });

  describe('unlinkAccount', () => {
    it('OAuth連携を解除できる', async () => {
      const mockAccount = { id: '1', provider: 'github', providerAccountId: 'gh123' };
      mockAccountRepo.findByUserIdAndProvider.mockResolvedValue(mockAccount);
      mockAccountRepo.countByUserId.mockResolvedValue(2); // 2つの連携がある
      mockAccountRepo.delete.mockResolvedValue(undefined);

      const result = await service.unlinkAccount('user-1', 'github');

      expect(mockAccountRepo.findByUserIdAndProvider).toHaveBeenCalledWith('user-1', 'github');
      expect(mockAccountRepo.countByUserId).toHaveBeenCalledWith('user-1');
      expect(mockAccountRepo.delete).toHaveBeenCalledWith('1');
      expect(result).toEqual({ success: true });
    });

    it('連携が存在しない場合はNotFoundErrorを投げる', async () => {
      mockAccountRepo.findByUserIdAndProvider.mockResolvedValue(null);

      await expect(service.unlinkAccount('user-1', 'github')).rejects.toThrow(NotFoundError);
    });

    it('最後の1つの連携は解除できない', async () => {
      const mockAccount = { id: '1', provider: 'github', providerAccountId: 'gh123' };
      mockAccountRepo.findByUserIdAndProvider.mockResolvedValue(mockAccount);
      mockAccountRepo.countByUserId.mockResolvedValue(1); // 1つしか連携がない

      await expect(service.unlinkAccount('user-1', 'github')).rejects.toThrow(ValidationError);
    });
  });

  describe('checkCanLink', () => {
    it('未連携のプロバイダーは連携可能', async () => {
      mockAccountRepo.findByUserIdAndProvider.mockResolvedValue(null);

      const result = await service.checkCanLink('user-1', 'github');

      expect(result).toBe(true);
    });

    it('既に連携済みのプロバイダーは連携不可', async () => {
      const mockAccount = { id: '1', provider: 'github', providerAccountId: 'gh123' };
      mockAccountRepo.findByUserIdAndProvider.mockResolvedValue(mockAccount);

      const result = await service.checkCanLink('user-1', 'github');

      expect(result).toBe(false);
    });
  });
});
