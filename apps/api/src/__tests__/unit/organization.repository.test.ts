import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationRepository } from '../../repositories/organization.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaOrganization = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    organization: mockPrismaOrganization,
  },
}));

describe('OrganizationRepository', () => {
  let repository: OrganizationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new OrganizationRepository();
  });

  describe('findById', () => {
    it('IDで組織を取得できる', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        description: 'Test description',
        deletedAt: null,
      };
      mockPrismaOrganization.findFirst.mockResolvedValue(mockOrg);

      const result = await repository.findById('org-1');

      expect(mockPrismaOrganization.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'org-1',
          deletedAt: null,
        },
      });
      expect(result).toEqual(mockOrg);
    });

    it('削除済み組織はnullを返す', async () => {
      mockPrismaOrganization.findFirst.mockResolvedValue(null);

      const result = await repository.findById('deleted-org');

      expect(mockPrismaOrganization.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'deleted-org',
          deletedAt: null,
        },
      });
      expect(result).toBeNull();
    });

    it('存在しないIDはnullを返す', async () => {
      mockPrismaOrganization.findFirst.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('nameを更新できる', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Updated Name',
      };
      mockPrismaOrganization.update.mockResolvedValue(mockOrg);

      const result = await repository.update('org-1', { name: 'Updated Name' });

      expect(mockPrismaOrganization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { name: 'Updated Name' },
      });
      expect(result).toEqual(mockOrg);
    });

    it('descriptionを更新できる', async () => {
      const mockOrg = {
        id: 'org-1',
        description: 'New description',
      };
      mockPrismaOrganization.update.mockResolvedValue(mockOrg);

      const result = await repository.update('org-1', { description: 'New description' });

      expect(mockPrismaOrganization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { description: 'New description' },
      });
      expect(result).toEqual(mockOrg);
    });

    it('descriptionをnullに設定できる', async () => {
      const mockOrg = {
        id: 'org-1',
        description: null,
      };
      mockPrismaOrganization.update.mockResolvedValue(mockOrg);

      const result = await repository.update('org-1', { description: null });

      expect(mockPrismaOrganization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { description: null },
      });
      expect(result).toEqual(mockOrg);
    });

    it('複数フィールドを同時に更新できる', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'New Name',
        description: 'New description',
      };
      mockPrismaOrganization.update.mockResolvedValue(mockOrg);

      const result = await repository.update('org-1', {
        name: 'New Name',
        description: 'New description',
      });

      expect(mockPrismaOrganization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: {
          name: 'New Name',
          description: 'New description',
        },
      });
      expect(result).toEqual(mockOrg);
    });
  });

  describe('softDelete', () => {
    it('組織を論理削除できる', async () => {
      const mockOrg = {
        id: 'org-1',
        deletedAt: new Date(),
      };
      mockPrismaOrganization.update.mockResolvedValue(mockOrg);

      const result = await repository.softDelete('org-1');

      expect(mockPrismaOrganization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result).toEqual(mockOrg);
      expect(result.deletedAt).not.toBeNull();
    });
  });

  describe('findDeletedById', () => {
    it('削除済み組織をIDで検索できる', async () => {
      const deletedAt = new Date();
      const mockOrg = {
        id: 'org-1',
        name: 'Deleted Organization',
        deletedAt,
      };
      mockPrismaOrganization.findFirst.mockResolvedValue(mockOrg);

      const result = await repository.findDeletedById('org-1');

      expect(mockPrismaOrganization.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'org-1',
          deletedAt: { not: null },
        },
      });
      expect(result).toEqual(mockOrg);
    });

    it('未削除の組織はnullを返す', async () => {
      mockPrismaOrganization.findFirst.mockResolvedValue(null);

      const result = await repository.findDeletedById('active-org');

      expect(result).toBeNull();
    });

    it('存在しないIDはnullを返す', async () => {
      mockPrismaOrganization.findFirst.mockResolvedValue(null);

      const result = await repository.findDeletedById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('restore', () => {
    it('削除済み組織を復元できる', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Restored Organization',
        deletedAt: null,
      };
      mockPrismaOrganization.update.mockResolvedValue(mockOrg);

      const result = await repository.restore('org-1');

      expect(mockPrismaOrganization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { deletedAt: null },
      });
      expect(result).toEqual(mockOrg);
      expect(result.deletedAt).toBeNull();
    });
  });
});
