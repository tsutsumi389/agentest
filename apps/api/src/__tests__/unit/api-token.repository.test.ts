import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma apiTokenのモック
const mockPrismaApiToken = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    apiToken: mockPrismaApiToken,
  },
}));

import { ApiTokenRepository } from '../../repositories/api-token.repository.js';

// テスト用の固定値
const TEST_TOKEN_ID = '11111111-1111-1111-1111-111111111111';
const TEST_USER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_ORG_ID = '33333333-3333-3333-3333-333333333333';
const TEST_TOKEN_HASH = 'sha256_hashed_token_value';

describe('ApiTokenRepository', () => {
  let repository: ApiTokenRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ApiTokenRepository();
  });

  describe('findByHash', () => {
    it('有効なトークンをハッシュで検索できる', async () => {
      const mockToken = {
        id: TEST_TOKEN_ID,
        tokenHash: TEST_TOKEN_HASH,
        user: { id: TEST_USER_ID, email: 'test@example.com', name: 'Test User', deletedAt: null },
        organization: { id: TEST_ORG_ID, name: 'Test Org', deletedAt: null },
      };
      mockPrismaApiToken.findFirst.mockResolvedValue(mockToken);

      const result = await repository.findByHash(TEST_TOKEN_HASH);

      expect(mockPrismaApiToken.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: TEST_TOKEN_HASH,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, deletedAt: true },
          },
          organization: {
            select: { id: true, name: true, deletedAt: true },
          },
        },
      });
      expect(result).toEqual(mockToken);
    });

    it('存在しないハッシュの場合はnullを返す', async () => {
      mockPrismaApiToken.findFirst.mockResolvedValue(null);

      const result = await repository.findByHash('nonexistent_hash');

      expect(result).toBeNull();
    });
  });

  describe('updateLastUsedAt', () => {
    it('最終使用日時を更新できる', async () => {
      const mockToken = { id: TEST_TOKEN_ID, lastUsedAt: new Date() };
      mockPrismaApiToken.update.mockResolvedValue(mockToken);

      const result = await repository.updateLastUsedAt(TEST_TOKEN_ID);

      expect(mockPrismaApiToken.update).toHaveBeenCalledWith({
        where: { id: TEST_TOKEN_ID },
        data: { lastUsedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockToken);
    });
  });

  describe('create', () => {
    it('APIトークンを作成できる', async () => {
      const tokenData = {
        userId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        name: 'My API Token',
        tokenHash: TEST_TOKEN_HASH,
        tokenPrefix: 'at_xxxx',
        scopes: ['read', 'write'],
        expiresAt: new Date('2025-12-31T23:59:59.999Z'),
      };
      const mockToken = { id: TEST_TOKEN_ID, ...tokenData, createdAt: new Date() };
      mockPrismaApiToken.create.mockResolvedValue(mockToken);

      const result = await repository.create(tokenData);

      expect(mockPrismaApiToken.create).toHaveBeenCalledWith({
        data: tokenData,
      });
      expect(result).toEqual(mockToken);
    });

    it('有効期限なしでAPIトークンを作成できる', async () => {
      const tokenData = {
        userId: TEST_USER_ID,
        name: 'Permanent Token',
        tokenHash: TEST_TOKEN_HASH,
        tokenPrefix: 'at_yyyy',
        scopes: ['read'],
      };
      const mockToken = { id: TEST_TOKEN_ID, ...tokenData, createdAt: new Date() };
      mockPrismaApiToken.create.mockResolvedValue(mockToken);

      const result = await repository.create(tokenData);

      expect(mockPrismaApiToken.create).toHaveBeenCalledWith({
        data: tokenData,
      });
      expect(result).toEqual(mockToken);
    });
  });

  describe('revoke', () => {
    it('APIトークンを失効させることができる', async () => {
      const mockToken = { id: TEST_TOKEN_ID, revokedAt: new Date() };
      mockPrismaApiToken.update.mockResolvedValue(mockToken);

      const result = await repository.revoke(TEST_TOKEN_ID);

      expect(mockPrismaApiToken.update).toHaveBeenCalledWith({
        where: { id: TEST_TOKEN_ID },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockToken);
    });
  });

  describe('findByUserId', () => {
    it('ユーザーのAPIトークン一覧を取得できる', async () => {
      const mockTokens = [
        { id: TEST_TOKEN_ID, userId: TEST_USER_ID, name: 'Token 1', createdAt: new Date() },
        {
          id: '44444444-4444-4444-4444-444444444444',
          userId: TEST_USER_ID,
          name: 'Token 2',
          createdAt: new Date(),
        },
      ];
      mockPrismaApiToken.findMany.mockResolvedValue(mockTokens);

      const result = await repository.findByUserId(TEST_USER_ID);

      expect(mockPrismaApiToken.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockTokens);
      expect(result).toHaveLength(2);
    });

    it('トークンが存在しない場合は空配列を返す', async () => {
      mockPrismaApiToken.findMany.mockResolvedValue([]);

      const result = await repository.findByUserId(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('findByOrganizationId', () => {
    it('組織のAPIトークン一覧を取得できる', async () => {
      const mockTokens = [
        {
          id: TEST_TOKEN_ID,
          organizationId: TEST_ORG_ID,
          name: 'Org Token 1',
          createdAt: new Date(),
        },
      ];
      mockPrismaApiToken.findMany.mockResolvedValue(mockTokens);

      const result = await repository.findByOrganizationId(TEST_ORG_ID);

      expect(mockPrismaApiToken.findMany).toHaveBeenCalledWith({
        where: { organizationId: TEST_ORG_ID },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockTokens);
    });

    it('トークンが存在しない場合は空配列を返す', async () => {
      mockPrismaApiToken.findMany.mockResolvedValue([]);

      const result = await repository.findByOrganizationId(TEST_ORG_ID);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('IDでAPIトークンを取得できる', async () => {
      const mockToken = {
        id: TEST_TOKEN_ID,
        name: 'My Token',
        tokenHash: TEST_TOKEN_HASH,
        userId: TEST_USER_ID,
      };
      mockPrismaApiToken.findUnique.mockResolvedValue(mockToken);

      const result = await repository.findById(TEST_TOKEN_ID);

      expect(mockPrismaApiToken.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_TOKEN_ID },
      });
      expect(result).toEqual(mockToken);
    });

    it('存在しないIDの場合はnullを返す', async () => {
      mockPrismaApiToken.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});
