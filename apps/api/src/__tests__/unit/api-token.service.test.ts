import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiTokenService } from '../../services/api-token.service.js';
import { NotFoundError, AuthorizationError, ValidationError } from '@agentest/shared';

// ApiTokenRepository のモック
const mockApiTokenRepo = {
  findByHash: vi.fn(),
  updateLastUsedAt: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
  findByUserId: vi.fn(),
  findById: vi.fn(),
};

vi.mock('../../repositories/api-token.repository.js', () => ({
  ApiTokenRepository: vi.fn().mockImplementation(() => mockApiTokenRepo),
}));

// crypto のモック（トークン生成のテスト用）
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn().mockReturnValue(Buffer.from('a'.repeat(32))),
  };
});

describe('ApiTokenService', () => {
  let service: ApiTokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiTokenService();
  });

  describe('validateToken', () => {
    it('無効なプレフィックスのトークンはvalid: falseを返す', async () => {
      const result = await service.validateToken('invalid_token');

      expect(result.valid).toBe(false);
      expect(mockApiTokenRepo.findByHash).not.toHaveBeenCalled();
    });

    it('短すぎるトークンはvalid: falseを返す', async () => {
      const result = await service.validateToken('agentest_short');

      expect(result.valid).toBe(false);
      expect(mockApiTokenRepo.findByHash).not.toHaveBeenCalled();
    });

    it('存在しないトークンはvalid: falseを返す', async () => {
      mockApiTokenRepo.findByHash.mockResolvedValue(null);

      const result = await service.validateToken('agentest_' + 'a'.repeat(43));

      expect(result.valid).toBe(false);
    });

    it('有効なトークンで認証成功', async () => {
      const mockToken = {
        id: 'token-1',
        userId: 'user-1',
        organizationId: null,
        scopes: ['*'],
        user: { id: 'user-1', email: 'test@example.com', name: 'Test', deletedAt: null },
        organization: null,
      };
      mockApiTokenRepo.findByHash.mockResolvedValue(mockToken);
      mockApiTokenRepo.updateLastUsedAt.mockResolvedValue(undefined);

      const result = await service.validateToken('agentest_' + 'a'.repeat(43));

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-1');
      expect(result.scopes).toEqual(['*']);
      expect(result.tokenId).toBe('token-1');
    });

    it('削除済みユーザーのトークンはvalid: falseを返す', async () => {
      const mockToken = {
        id: 'token-1',
        userId: 'user-1',
        organizationId: null,
        scopes: ['*'],
        user: { id: 'user-1', email: 'test@example.com', name: 'Test', deletedAt: new Date() },
        organization: null,
      };
      mockApiTokenRepo.findByHash.mockResolvedValue(mockToken);

      const result = await service.validateToken('agentest_' + 'a'.repeat(43));

      expect(result.valid).toBe(false);
    });

    it('削除済み組織のトークンはvalid: falseを返す', async () => {
      const mockToken = {
        id: 'token-1',
        userId: null,
        organizationId: 'org-1',
        scopes: ['*'],
        user: null,
        organization: { id: 'org-1', name: 'Test Org', slug: 'test-org', deletedAt: new Date() },
      };
      mockApiTokenRepo.findByHash.mockResolvedValue(mockToken);

      const result = await service.validateToken('agentest_' + 'a'.repeat(43));

      expect(result.valid).toBe(false);
    });
  });

  describe('createToken', () => {
    it('ユーザートークンを作成できる', async () => {
      const mockCreatedToken = {
        id: 'token-1',
        userId: 'user-1',
        organizationId: null,
        name: 'My Token',
        tokenHash: 'hash',
        tokenPrefix: 'agentest_aaa',
        scopes: ['*'],
        expiresAt: null,
        createdAt: new Date(),
      };
      mockApiTokenRepo.create.mockResolvedValue(mockCreatedToken);

      const result = await service.createToken({
        userId: 'user-1',
        name: 'My Token',
      });

      expect(result.id).toBe('token-1');
      expect(result.name).toBe('My Token');
      expect(result.rawToken).toMatch(/^agentest_/);
      expect(result.scopes).toEqual(['*']);
      expect(mockApiTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          name: 'My Token',
          scopes: ['*'],
        })
      );
    });

    it('userIdもorganizationIdもない場合はValidationErrorを投げる', async () => {
      await expect(service.createToken({ name: 'My Token' }))
        .rejects.toThrow(ValidationError);
    });

    it('有効期限付きトークンを作成できる', async () => {
      const expiresAt = new Date('2030-01-01');
      const mockCreatedToken = {
        id: 'token-1',
        userId: 'user-1',
        name: 'My Token',
        tokenHash: 'hash',
        tokenPrefix: 'agentest_aaa',
        scopes: ['*'],
        expiresAt,
        createdAt: new Date(),
      };
      mockApiTokenRepo.create.mockResolvedValue(mockCreatedToken);

      const result = await service.createToken({
        userId: 'user-1',
        name: 'My Token',
        expiresAt,
      });

      expect(result.expiresAt).toEqual(expiresAt);
    });
  });

  describe('revokeToken', () => {
    it('自分のトークンを失効できる', async () => {
      const mockToken = {
        id: 'token-1',
        userId: 'user-1',
        revokedAt: null,
      };
      mockApiTokenRepo.findById.mockResolvedValue(mockToken);
      mockApiTokenRepo.revoke.mockResolvedValue(undefined);

      await service.revokeToken('token-1', 'user-1');

      expect(mockApiTokenRepo.revoke).toHaveBeenCalledWith('token-1');
    });

    it('存在しないトークンはNotFoundErrorを投げる', async () => {
      mockApiTokenRepo.findById.mockResolvedValue(null);

      await expect(service.revokeToken('token-1', 'user-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('他人のトークンはAuthorizationErrorを投げる', async () => {
      const mockToken = {
        id: 'token-1',
        userId: 'other-user',
        revokedAt: null,
      };
      mockApiTokenRepo.findById.mockResolvedValue(mockToken);

      await expect(service.revokeToken('token-1', 'user-1'))
        .rejects.toThrow(AuthorizationError);
    });

    it('既に失効済みのトークンはValidationErrorを投げる', async () => {
      const mockToken = {
        id: 'token-1',
        userId: 'user-1',
        revokedAt: new Date(),
      };
      mockApiTokenRepo.findById.mockResolvedValue(mockToken);

      await expect(service.revokeToken('token-1', 'user-1'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('listTokens', () => {
    it('ユーザーのトークン一覧を取得できる', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          name: 'Token 1',
          tokenPrefix: 'agentest_aaa',
          scopes: ['*'],
          expiresAt: null,
          lastUsedAt: new Date(),
          revokedAt: null,
          createdAt: new Date(),
        },
        {
          id: 'token-2',
          name: 'Token 2',
          tokenPrefix: 'agentest_bbb',
          scopes: ['mcp:read'],
          expiresAt: new Date('2030-01-01'),
          lastUsedAt: null,
          revokedAt: null,
          createdAt: new Date(),
        },
      ];
      mockApiTokenRepo.findByUserId.mockResolvedValue(mockTokens);

      const result = await service.listTokens('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Token 1');
      expect(result[1].name).toBe('Token 2');
      expect(mockApiTokenRepo.findByUserId).toHaveBeenCalledWith('user-1');
    });
  });
});
