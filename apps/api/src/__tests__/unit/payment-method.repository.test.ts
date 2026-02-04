import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaPaymentMethod = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
}));

const mockPrismaTransaction = vi.hoisted(() => vi.fn());

vi.mock('@agentest/db', () => ({
  prisma: {
    paymentMethod: mockPrismaPaymentMethod,
    $transaction: mockPrismaTransaction,
  },
}));

import { PaymentMethodRepository } from '../../repositories/payment-method.repository.js';

describe('PaymentMethodRepository', () => {
  let repository: PaymentMethodRepository;

  const userId = '11111111-1111-1111-1111-111111111111';
  const organizationId = '22222222-2222-2222-2222-222222222222';
  const paymentMethodId = '33333333-3333-3333-3333-333333333333';
  const externalId = 'pm_stripe_44444444';

  const mockPaymentMethod = {
    id: paymentMethodId,
    userId,
    organizationId: null,
    type: 'CARD',
    externalId,
    brand: 'visa',
    last4: '4242',
    expiryMonth: 12,
    expiryYear: 2025,
    isDefault: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PaymentMethodRepository();
  });

  describe('findByUserId', () => {
    it('ユーザーの支払い方法一覧を取得できる', async () => {
      const mockPaymentMethods = [
        mockPaymentMethod,
        { ...mockPaymentMethod, id: '55555555-5555-5555-5555-555555555555', isDefault: false },
      ];
      mockPrismaPaymentMethod.findMany.mockResolvedValue(mockPaymentMethods);

      const result = await repository.findByUserId(userId);

      expect(mockPrismaPaymentMethod.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toEqual(mockPaymentMethods);
    });

    it('支払い方法がない場合は空配列を返す', async () => {
      mockPrismaPaymentMethod.findMany.mockResolvedValue([]);

      const result = await repository.findByUserId(userId);

      expect(result).toEqual([]);
    });
  });

  describe('findByOrganizationId', () => {
    it('組織の支払い方法一覧を取得できる', async () => {
      const orgPaymentMethod = { ...mockPaymentMethod, userId: null, organizationId };
      mockPrismaPaymentMethod.findMany.mockResolvedValue([orgPaymentMethod]);

      const result = await repository.findByOrganizationId(organizationId);

      expect(mockPrismaPaymentMethod.findMany).toHaveBeenCalledWith({
        where: { organizationId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toEqual([orgPaymentMethod]);
    });

    it('支払い方法がない場合は空配列を返す', async () => {
      mockPrismaPaymentMethod.findMany.mockResolvedValue([]);

      const result = await repository.findByOrganizationId(organizationId);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('IDで支払い方法を取得できる', async () => {
      mockPrismaPaymentMethod.findUnique.mockResolvedValue(mockPaymentMethod);

      const result = await repository.findById(paymentMethodId);

      expect(mockPrismaPaymentMethod.findUnique).toHaveBeenCalledWith({
        where: { id: paymentMethodId },
      });
      expect(result).toEqual(mockPaymentMethod);
    });

    it('存在しないIDはnullを返す', async () => {
      mockPrismaPaymentMethod.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByExternalId', () => {
    it('外部IDで支払い方法を取得できる', async () => {
      mockPrismaPaymentMethod.findFirst.mockResolvedValue(mockPaymentMethod);

      const result = await repository.findByExternalId(externalId);

      expect(mockPrismaPaymentMethod.findFirst).toHaveBeenCalledWith({
        where: { externalId },
      });
      expect(result).toEqual(mockPaymentMethod);
    });

    it('存在しない外部IDはnullを返す', async () => {
      mockPrismaPaymentMethod.findFirst.mockResolvedValue(null);

      const result = await repository.findByExternalId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findDefaultByUserId', () => {
    it('ユーザーのデフォルト支払い方法を取得できる', async () => {
      mockPrismaPaymentMethod.findFirst.mockResolvedValue(mockPaymentMethod);

      const result = await repository.findDefaultByUserId(userId);

      expect(mockPrismaPaymentMethod.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          isDefault: true,
        },
      });
      expect(result).toEqual(mockPaymentMethod);
    });

    it('デフォルトが設定されていない場合はnullを返す', async () => {
      mockPrismaPaymentMethod.findFirst.mockResolvedValue(null);

      const result = await repository.findDefaultByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe('findDefaultByOrganizationId', () => {
    it('組織のデフォルト支払い方法を取得できる', async () => {
      const orgPaymentMethod = { ...mockPaymentMethod, userId: null, organizationId };
      mockPrismaPaymentMethod.findFirst.mockResolvedValue(orgPaymentMethod);

      const result = await repository.findDefaultByOrganizationId(organizationId);

      expect(mockPrismaPaymentMethod.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId,
          isDefault: true,
        },
      });
      expect(result).toEqual(orgPaymentMethod);
    });

    it('デフォルトが設定されていない場合はnullを返す', async () => {
      mockPrismaPaymentMethod.findFirst.mockResolvedValue(null);

      const result = await repository.findDefaultByOrganizationId(organizationId);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('支払い方法を作成できる', async () => {
      mockPrismaPaymentMethod.create.mockResolvedValue(mockPaymentMethod);

      const params = {
        userId,
        externalId,
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2025,
        isDefault: true,
      };

      const result = await repository.create(params);

      expect(mockPrismaPaymentMethod.create).toHaveBeenCalledWith({
        data: {
          userId,
          organizationId: undefined,
          type: 'CARD',
          externalId,
          brand: 'visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
          isDefault: true,
        },
      });
      expect(result).toEqual(mockPaymentMethod);
    });

    it('typeを指定しない場合はCARDがデフォルトになる', async () => {
      mockPrismaPaymentMethod.create.mockResolvedValue(mockPaymentMethod);

      await repository.create({
        userId,
        externalId,
      });

      expect(mockPrismaPaymentMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'CARD',
          }),
        })
      );
    });

    it('isDefaultを指定しない場合はfalseがデフォルトになる', async () => {
      mockPrismaPaymentMethod.create.mockResolvedValue({ ...mockPaymentMethod, isDefault: false });

      await repository.create({
        userId,
        externalId,
      });

      expect(mockPrismaPaymentMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDefault: false,
          }),
        })
      );
    });

    it('typeを明示的に指定できる', async () => {
      mockPrismaPaymentMethod.create.mockResolvedValue(mockPaymentMethod);

      await repository.create({
        userId,
        externalId,
        type: 'BANK_TRANSFER' as any,
      });

      expect(mockPrismaPaymentMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'BANK_TRANSFER',
          }),
        })
      );
    });
  });

  describe('update', () => {
    it('支払い方法を更新できる', async () => {
      const updated = { ...mockPaymentMethod, brand: 'mastercard', last4: '5555' };
      mockPrismaPaymentMethod.update.mockResolvedValue(updated);

      const result = await repository.update(paymentMethodId, {
        brand: 'mastercard',
        last4: '5555',
      });

      expect(mockPrismaPaymentMethod.update).toHaveBeenCalledWith({
        where: { id: paymentMethodId },
        data: {
          brand: 'mastercard',
          last4: '5555',
        },
      });
      expect(result).toEqual(updated);
    });

    it('undefinedのフィールドはdataに含まれない', async () => {
      mockPrismaPaymentMethod.update.mockResolvedValue(mockPaymentMethod);

      await repository.update(paymentMethodId, { brand: 'visa' });

      const callArg = mockPrismaPaymentMethod.update.mock.calls[0][0];
      expect(callArg.data).toEqual({ brand: 'visa' });
      expect(callArg.data).not.toHaveProperty('last4');
      expect(callArg.data).not.toHaveProperty('expiryMonth');
      expect(callArg.data).not.toHaveProperty('expiryYear');
      expect(callArg.data).not.toHaveProperty('isDefault');
    });

    it('全フィールドを更新できる', async () => {
      mockPrismaPaymentMethod.update.mockResolvedValue(mockPaymentMethod);

      await repository.update(paymentMethodId, {
        brand: 'amex',
        last4: '1234',
        expiryMonth: 6,
        expiryYear: 2026,
        isDefault: false,
      });

      expect(mockPrismaPaymentMethod.update).toHaveBeenCalledWith({
        where: { id: paymentMethodId },
        data: {
          brand: 'amex',
          last4: '1234',
          expiryMonth: 6,
          expiryYear: 2026,
          isDefault: false,
        },
      });
    });
  });

  describe('delete', () => {
    it('支払い方法を削除できる', async () => {
      mockPrismaPaymentMethod.delete.mockResolvedValue(mockPaymentMethod);

      await repository.delete(paymentMethodId);

      expect(mockPrismaPaymentMethod.delete).toHaveBeenCalledWith({
        where: { id: paymentMethodId },
      });
    });
  });

  describe('setDefaultForUser', () => {
    it('ユーザーのデフォルト支払い方法を設定できる', async () => {
      mockPrismaTransaction.mockResolvedValue(undefined);

      await repository.setDefaultForUser(userId, paymentMethodId);

      expect(mockPrismaTransaction).toHaveBeenCalledWith([
        mockPrismaPaymentMethod.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        }),
        mockPrismaPaymentMethod.update({
          where: { id: paymentMethodId },
          data: { isDefault: true },
        }),
      ]);
    });

    it('既存のデフォルトを解除してから新しいデフォルトを設定する', async () => {
      mockPrismaTransaction.mockResolvedValue(undefined);

      await repository.setDefaultForUser(userId, paymentMethodId);

      // updateManyが呼ばれて既存のデフォルトを解除
      expect(mockPrismaPaymentMethod.updateMany).toHaveBeenCalledWith({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
      // updateが呼ばれて新しいデフォルトを設定
      expect(mockPrismaPaymentMethod.update).toHaveBeenCalledWith({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      });
    });
  });

  describe('setDefaultForOrganization', () => {
    it('組織のデフォルト支払い方法を設定できる', async () => {
      mockPrismaTransaction.mockResolvedValue(undefined);

      await repository.setDefaultForOrganization(organizationId, paymentMethodId);

      expect(mockPrismaTransaction).toHaveBeenCalledWith([
        mockPrismaPaymentMethod.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        }),
        mockPrismaPaymentMethod.update({
          where: { id: paymentMethodId },
          data: { isDefault: true },
        }),
      ]);
    });

    it('既存のデフォルトを解除してから新しいデフォルトを設定する', async () => {
      mockPrismaTransaction.mockResolvedValue(undefined);

      await repository.setDefaultForOrganization(organizationId, paymentMethodId);

      // updateManyが呼ばれて既存のデフォルトを解除
      expect(mockPrismaPaymentMethod.updateMany).toHaveBeenCalledWith({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
      // updateが呼ばれて新しいデフォルトを設定
      expect(mockPrismaPaymentMethod.update).toHaveBeenCalledWith({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      });
    });
  });

  describe('countByUserId', () => {
    it('ユーザーの支払い方法数を取得できる', async () => {
      mockPrismaPaymentMethod.count.mockResolvedValue(3);

      const result = await repository.countByUserId(userId);

      expect(mockPrismaPaymentMethod.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toBe(3);
    });

    it('支払い方法がない場合は0を返す', async () => {
      mockPrismaPaymentMethod.count.mockResolvedValue(0);

      const result = await repository.countByUserId(userId);

      expect(result).toBe(0);
    });
  });

  describe('countByOrganizationId', () => {
    it('組織の支払い方法数を取得できる', async () => {
      mockPrismaPaymentMethod.count.mockResolvedValue(2);

      const result = await repository.countByOrganizationId(organizationId);

      expect(mockPrismaPaymentMethod.count).toHaveBeenCalledWith({
        where: { organizationId },
      });
      expect(result).toBe(2);
    });

    it('支払い方法がない場合は0を返す', async () => {
      mockPrismaPaymentMethod.count.mockResolvedValue(0);

      const result = await repository.countByOrganizationId(organizationId);

      expect(result).toBe(0);
    });
  });
});
