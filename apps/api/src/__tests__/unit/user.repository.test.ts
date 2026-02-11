import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../../repositories/user.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaUser = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: mockPrismaUser,
  },
}));

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UserRepository();
  });

  describe('findById', () => {
    it('IDでユーザーを取得できる', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        deletedAt: null,
      };
      mockPrismaUser.findFirst.mockResolvedValue(mockUser);

      const result = await repository.findById('user-1');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          deletedAt: null,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('削除済みユーザーはnullを返す', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findById('deleted-user');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'deleted-user',
          deletedAt: null,
        },
      });
      expect(result).toBeNull();
    });

    it('存在しないIDはnullを返す', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('メールでユーザーを取得できる', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };
      mockPrismaUser.findFirst.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          deletedAt: null,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('削除済みユーザーはnullを返す', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findByEmail('deleted@example.com');

      expect(result).toBeNull();
    });

    it('存在しないメールはnullを返す', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('nameを更新できる', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Updated Name',
        avatarUrl: null,
      };
      mockPrismaUser.update.mockResolvedValue(mockUser);

      const result = await repository.update('user-1', { name: 'Updated Name' });

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Updated Name' },
      });
      expect(result).toEqual(mockUser);
    });

    it('avatarUrlを更新できる', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      };
      mockPrismaUser.update.mockResolvedValue(mockUser);

      const result = await repository.update('user-1', {
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: 'https://example.com/avatar.png' },
      });
      expect(result).toEqual(mockUser);
    });

    it('avatarUrlをnullに設定できる', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        avatarUrl: null,
      };
      mockPrismaUser.update.mockResolvedValue(mockUser);

      const result = await repository.update('user-1', { avatarUrl: null });

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: null },
      });
      expect(result).toEqual(mockUser);
    });

    it('nameとavatarUrlを同時に更新できる', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'New Name',
        avatarUrl: 'https://example.com/new-avatar.png',
      };
      mockPrismaUser.update.mockResolvedValue(mockUser);

      const result = await repository.update('user-1', {
        name: 'New Name',
        avatarUrl: 'https://example.com/new-avatar.png',
      });

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          name: 'New Name',
          avatarUrl: 'https://example.com/new-avatar.png',
        },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('softDelete', () => {
    it('ユーザーを論理削除できる', async () => {
      const mockUser = {
        id: 'user-1',
        deletedAt: new Date(),
      };
      mockPrismaUser.update.mockResolvedValue(mockUser);

      const result = await repository.softDelete('user-1');

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockUser);
      expect(result.deletedAt).not.toBeNull();
    });
  });

  describe('enableTotp', () => {
    it('TOTPを有効化し、暗号化済み秘密鍵を保存できる', async () => {
      mockPrismaUser.update.mockResolvedValue(undefined);

      await repository.enableTotp('user-1', 'encrypted-secret-value');

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          totpSecret: 'encrypted-secret-value',
          totpEnabled: true,
        },
      });
    });

    it('戻り値がvoidである', async () => {
      mockPrismaUser.update.mockResolvedValue(undefined);

      const result = await repository.enableTotp('user-1', 'encrypted-secret');

      expect(result).toBeUndefined();
    });
  });

  describe('disableTotp', () => {
    it('TOTPを無効化し、秘密鍵をnullにする', async () => {
      mockPrismaUser.update.mockResolvedValue(undefined);

      await repository.disableTotp('user-1');

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          totpSecret: null,
          totpEnabled: false,
        },
      });
    });

    it('戻り値がvoidである', async () => {
      mockPrismaUser.update.mockResolvedValue(undefined);

      const result = await repository.disableTotp('user-1');

      expect(result).toBeUndefined();
    });
  });

  describe('getTotpSecret', () => {
    it('TOTP秘密鍵を取得できる', async () => {
      mockPrismaUser.findFirst.mockResolvedValue({
        totpSecret: 'encrypted-secret-value',
      });

      const result = await repository.getTotpSecret('user-1');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          deletedAt: null,
        },
        select: {
          totpSecret: true,
        },
      });
      expect(result).toBe('encrypted-secret-value');
    });

    it('TOTP未設定の場合nullを返す', async () => {
      mockPrismaUser.findFirst.mockResolvedValue({
        totpSecret: null,
      });

      const result = await repository.getTotpSecret('user-1');

      expect(result).toBeNull();
    });

    it('ユーザーが存在しない場合nullを返す', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.getTotpSecret('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithPassword', () => {
    it('パスワードハッシュ含むユーザー情報を取得できる', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        totpEnabled: false,
        passwordHash: 'hashed-password',
      };
      mockPrismaUser.findFirst.mockResolvedValue(mockUser);

      const result = await repository.findByIdWithPassword('user-1');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          totpEnabled: true,
          passwordHash: true,
        },
      });
      expect(result).toEqual(mockUser);
      expect(result?.passwordHash).toBe('hashed-password');
    });

    it('削除済みユーザーはnullを返す', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdWithPassword('deleted-user');

      expect(result).toBeNull();
    });

    it('存在しないユーザーはnullを返す', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdWithPassword('non-existent');

      expect(result).toBeNull();
    });
  });
});
