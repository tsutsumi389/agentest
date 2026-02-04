import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaSubscription = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    subscription: mockPrismaSubscription,
  },
}));

import { SubscriptionRepository } from '../../repositories/subscription.repository.js';

describe('SubscriptionRepository', () => {
  let repository: SubscriptionRepository;

  const userId = '11111111-1111-1111-1111-111111111111';
  const organizationId = '22222222-2222-2222-2222-222222222222';
  const subscriptionId = '33333333-3333-3333-3333-333333333333';
  const externalId = 'sub_stripe_44444444';

  const mockSubscription = {
    id: subscriptionId,
    userId,
    organizationId: null,
    externalId,
    plan: 'PRO',
    billingCycle: 'MONTHLY',
    status: 'ACTIVE',
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SubscriptionRepository();
  });

  describe('findByUserId', () => {
    it('ユーザーIDでサブスクリプションを取得できる', async () => {
      mockPrismaSubscription.findFirst.mockResolvedValue(mockSubscription);

      const result = await repository.findByUserId(userId);

      expect(mockPrismaSubscription.findFirst).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('サブスクリプションが存在しない場合はnullを返す', async () => {
      mockPrismaSubscription.findFirst.mockResolvedValue(null);

      const result = await repository.findByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe('findByOrganizationId', () => {
    it('組織IDでサブスクリプションを取得できる', async () => {
      const orgSubscription = { ...mockSubscription, userId: null, organizationId };
      mockPrismaSubscription.findFirst.mockResolvedValue(orgSubscription);

      const result = await repository.findByOrganizationId(organizationId);

      expect(mockPrismaSubscription.findFirst).toHaveBeenCalledWith({
        where: { organizationId },
      });
      expect(result).toEqual(orgSubscription);
    });

    it('サブスクリプションが存在しない場合はnullを返す', async () => {
      mockPrismaSubscription.findFirst.mockResolvedValue(null);

      const result = await repository.findByOrganizationId(organizationId);

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('IDでサブスクリプションを取得できる', async () => {
      mockPrismaSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await repository.findById(subscriptionId);

      expect(mockPrismaSubscription.findUnique).toHaveBeenCalledWith({
        where: { id: subscriptionId },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('存在しないIDはnullを返す', async () => {
      mockPrismaSubscription.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('サブスクリプションを作成できる', async () => {
      mockPrismaSubscription.create.mockResolvedValue(mockSubscription);

      const params = {
        userId,
        plan: 'PRO' as const,
        billingCycle: 'MONTHLY' as const,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        externalId,
      };

      const result = await repository.create(params);

      expect(mockPrismaSubscription.create).toHaveBeenCalledWith({
        data: {
          userId,
          organizationId: undefined,
          externalId,
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
        },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('statusを指定しない場合はACTIVEがデフォルトになる', async () => {
      mockPrismaSubscription.create.mockResolvedValue(mockSubscription);

      await repository.create({
        userId,
        plan: 'PRO' as const,
        billingCycle: 'MONTHLY' as const,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      expect(mockPrismaSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            cancelAtPeriodEnd: false,
          }),
        })
      );
    });

    it('statusを明示的に指定できる', async () => {
      const trialSubscription = { ...mockSubscription, status: 'TRIALING' };
      mockPrismaSubscription.create.mockResolvedValue(trialSubscription);

      await repository.create({
        userId,
        plan: 'PRO' as const,
        billingCycle: 'MONTHLY' as const,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        status: 'TRIALING' as const,
      });

      expect(mockPrismaSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'TRIALING',
          }),
        })
      );
    });

    it('cancelAtPeriodEndを明示的に指定できる', async () => {
      mockPrismaSubscription.create.mockResolvedValue({ ...mockSubscription, cancelAtPeriodEnd: true });

      await repository.create({
        userId,
        plan: 'PRO' as const,
        billingCycle: 'MONTHLY' as const,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        cancelAtPeriodEnd: true,
      });

      expect(mockPrismaSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cancelAtPeriodEnd: true,
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('サブスクリプションを更新できる', async () => {
      const updatedSubscription = { ...mockSubscription, plan: 'ENTERPRISE' };
      mockPrismaSubscription.update.mockResolvedValue(updatedSubscription);

      const result = await repository.update(subscriptionId, { plan: 'ENTERPRISE' as const });

      expect(mockPrismaSubscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: { plan: 'ENTERPRISE' },
      });
      expect(result).toEqual(updatedSubscription);
    });

    it('undefinedのフィールドはdataに含まれない', async () => {
      mockPrismaSubscription.update.mockResolvedValue(mockSubscription);

      await repository.update(subscriptionId, { plan: 'PRO' as const });

      const callArg = mockPrismaSubscription.update.mock.calls[0][0];
      expect(callArg.data).toEqual({ plan: 'PRO' });
      expect(callArg.data).not.toHaveProperty('status');
      expect(callArg.data).not.toHaveProperty('billingCycle');
      expect(callArg.data).not.toHaveProperty('externalId');
    });

    it('複数のフィールドを同時に更新できる', async () => {
      const updatedSubscription = {
        ...mockSubscription,
        status: 'CANCELED',
        cancelAtPeriodEnd: true,
      };
      mockPrismaSubscription.update.mockResolvedValue(updatedSubscription);

      await repository.update(subscriptionId, {
        status: 'CANCELED' as const,
        cancelAtPeriodEnd: true,
      });

      expect(mockPrismaSubscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: {
          status: 'CANCELED',
          cancelAtPeriodEnd: true,
        },
      });
    });

    it('全フィールドを更新できる', async () => {
      mockPrismaSubscription.update.mockResolvedValue(mockSubscription);

      const newStart = new Date('2024-02-01');
      const newEnd = new Date('2024-03-01');

      await repository.update(subscriptionId, {
        externalId: 'sub_new',
        plan: 'ENTERPRISE' as const,
        billingCycle: 'YEARLY' as const,
        status: 'ACTIVE' as const,
        currentPeriodStart: newStart,
        currentPeriodEnd: newEnd,
        cancelAtPeriodEnd: false,
      });

      expect(mockPrismaSubscription.update).toHaveBeenCalledWith({
        where: { id: subscriptionId },
        data: {
          externalId: 'sub_new',
          plan: 'ENTERPRISE',
          billingCycle: 'YEARLY',
          status: 'ACTIVE',
          currentPeriodStart: newStart,
          currentPeriodEnd: newEnd,
          cancelAtPeriodEnd: false,
        },
      });
    });
  });

  describe('delete', () => {
    it('サブスクリプションを削除できる', async () => {
      mockPrismaSubscription.delete.mockResolvedValue(mockSubscription);

      await repository.delete(subscriptionId);

      expect(mockPrismaSubscription.delete).toHaveBeenCalledWith({
        where: { id: subscriptionId },
      });
    });
  });

  describe('upsertForUser', () => {
    it('ユーザーのサブスクリプションをアップサートできる', async () => {
      mockPrismaSubscription.upsert.mockResolvedValue(mockSubscription);

      const params = {
        externalId,
        plan: 'PRO' as const,
        billingCycle: 'MONTHLY' as const,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      };

      const result = await repository.upsertForUser(userId, params);

      expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          externalId,
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
        },
        update: {
          externalId,
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
        },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('statusとcancelAtPeriodEndのデフォルト値が適用される', async () => {
      mockPrismaSubscription.upsert.mockResolvedValue(mockSubscription);

      await repository.upsertForUser(userId, {
        plan: 'PRO' as const,
        billingCycle: 'MONTHLY' as const,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      });

      expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'ACTIVE',
            cancelAtPeriodEnd: false,
          }),
          update: expect.objectContaining({
            status: 'ACTIVE',
            cancelAtPeriodEnd: false,
          }),
        })
      );
    });
  });

  describe('upsertForOrganization', () => {
    it('組織のサブスクリプションをアップサートできる', async () => {
      const orgSubscription = { ...mockSubscription, userId: null, organizationId };
      mockPrismaSubscription.upsert.mockResolvedValue(orgSubscription);

      const params = {
        externalId,
        plan: 'PRO' as const,
        billingCycle: 'MONTHLY' as const,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
      };

      const result = await repository.upsertForOrganization(organizationId, params);

      expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith({
        where: { organizationId },
        create: {
          organizationId,
          externalId,
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
        },
        update: {
          externalId,
          plan: 'PRO',
          billingCycle: 'MONTHLY',
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
        },
      });
      expect(result).toEqual(orgSubscription);
    });

    it('statusを明示的に指定してアップサートできる', async () => {
      mockPrismaSubscription.upsert.mockResolvedValue(mockSubscription);

      await repository.upsertForOrganization(organizationId, {
        plan: 'PRO' as const,
        billingCycle: 'MONTHLY' as const,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-02-01'),
        status: 'TRIALING' as const,
        cancelAtPeriodEnd: true,
      });

      expect(mockPrismaSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'TRIALING',
            cancelAtPeriodEnd: true,
          }),
          update: expect.objectContaining({
            status: 'TRIALING',
            cancelAtPeriodEnd: true,
          }),
        })
      );
    });
  });

  describe('findByExternalId', () => {
    it('外部IDでサブスクリプションを取得できる', async () => {
      mockPrismaSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await repository.findByExternalId(externalId);

      expect(mockPrismaSubscription.findUnique).toHaveBeenCalledWith({
        where: { externalId },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('存在しない外部IDはnullを返す', async () => {
      mockPrismaSubscription.findUnique.mockResolvedValue(null);

      const result = await repository.findByExternalId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findCancelAtPeriodEnd', () => {
    it('期間終了時にキャンセル予定のサブスクリプションを取得できる', async () => {
      const cancelSubscriptions = [
        { ...mockSubscription, cancelAtPeriodEnd: true },
        { ...mockSubscription, id: '44444444-4444-4444-4444-444444444444', cancelAtPeriodEnd: true },
      ];
      mockPrismaSubscription.findMany.mockResolvedValue(cancelSubscriptions);

      const result = await repository.findCancelAtPeriodEnd();

      expect(mockPrismaSubscription.findMany).toHaveBeenCalledWith({
        where: {
          cancelAtPeriodEnd: true,
          status: 'ACTIVE',
        },
      });
      expect(result).toHaveLength(2);
    });

    it('該当なしの場合は空配列を返す', async () => {
      mockPrismaSubscription.findMany.mockResolvedValue([]);

      const result = await repository.findCancelAtPeriodEnd();

      expect(result).toEqual([]);
    });
  });

  describe('findExpired', () => {
    it('期限切れのサブスクリプションを取得できる', async () => {
      const beforeDate = new Date('2024-02-01');
      const expiredSubscriptions = [mockSubscription];
      mockPrismaSubscription.findMany.mockResolvedValue(expiredSubscriptions);

      const result = await repository.findExpired(beforeDate);

      expect(mockPrismaSubscription.findMany).toHaveBeenCalledWith({
        where: {
          currentPeriodEnd: {
            lt: beforeDate,
          },
          status: 'ACTIVE',
        },
      });
      expect(result).toEqual(expiredSubscriptions);
    });

    it('期限切れがない場合は空配列を返す', async () => {
      mockPrismaSubscription.findMany.mockResolvedValue([]);

      const result = await repository.findExpired(new Date());

      expect(result).toEqual([]);
    });
  });
});
