import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@agentest/shared';

// リポジトリとゲートウェイのモック
vi.mock('../../repositories/payment-method.repository.js', () => ({
  PaymentMethodRepository: vi.fn().mockImplementation(() => ({
    findByUserId: vi.fn(),
    findById: vi.fn(),
    countByUserId: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    setDefaultForUser: vi.fn(),
  })),
}));

vi.mock('../../gateways/payment/index.js', () => ({
  getPaymentGateway: vi.fn().mockImplementation(() => ({
    createCustomer: vi.fn(),
    getCustomer: vi.fn(),
    attachPaymentMethod: vi.fn(),
    detachPaymentMethod: vi.fn(),
    listPaymentMethods: vi.fn(),
    setDefaultPaymentMethod: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
    previewProration: vi.fn(),
    getInvoice: vi.fn(),
    listInvoices: vi.fn(),
    getInvoicePdf: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    parseWebhookEvent: vi.fn(),
  })),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// モックをインポート
import { PaymentMethodService } from '../../services/payment-method.service.js';
import { PaymentMethodRepository } from '../../repositories/payment-method.repository.js';
import { getPaymentGateway } from '../../gateways/payment/index.js';
import { prisma } from '@agentest/db';

describe('PaymentMethodService', () => {
  let service: PaymentMethodService;
  let mockPaymentMethodRepo: ReturnType<typeof PaymentMethodRepository.prototype.constructor>;
  let mockPaymentGateway: ReturnType<typeof getPaymentGateway>;
  const testUserId = 'user-123';
  const testPaymentMethodId = 'pm-123';
  const now = new Date();

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentMethodService();
    // モックインスタンスを取得
    mockPaymentMethodRepo = (PaymentMethodRepository as any).mock.results[0]?.value ||
      (PaymentMethodRepository as any)();
    mockPaymentGateway = (getPaymentGateway as any).mock.results[0]?.value ||
      (getPaymentGateway as any)();
  });

  describe('getPaymentMethods', () => {
    it('ユーザーの支払い方法一覧を取得できる', async () => {
      const mockPaymentMethods = [
        {
          id: 'pm-1',
          userId: testUserId,
          brand: 'visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2030,
          isDefault: true,
          createdAt: now,
        },
        {
          id: 'pm-2',
          userId: testUserId,
          brand: 'mastercard',
          last4: '5555',
          expiryMonth: 6,
          expiryYear: 2025,
          isDefault: false,
          createdAt: now,
        },
      ];
      vi.mocked(mockPaymentMethodRepo.findByUserId).mockResolvedValue(mockPaymentMethods);

      const result = await service.getPaymentMethods(testUserId);

      expect(mockPaymentMethodRepo.findByUserId).toHaveBeenCalledWith(testUserId);
      expect(result).toHaveLength(2);
      expect(result[0].brand).toBe('visa');
      expect(result[0].isDefault).toBe(true);
    });

    it('支払い方法が存在しない場合は空配列を返す', async () => {
      vi.mocked(mockPaymentMethodRepo.findByUserId).mockResolvedValue([]);

      const result = await service.getPaymentMethods(testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('addPaymentMethod', () => {
    const testToken = 'tok_visa_4242';

    it('支払い方法を追加できる', async () => {
      // ユーザーが存在する
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUserId,
        email: 'test@example.com',
        paymentCustomerId: 'cus_123',
      } as any);

      // 決済ゲートウェイに支払い方法を紐付け
      vi.mocked(mockPaymentGateway.attachPaymentMethod).mockResolvedValue({
        id: 'pm_external_123',
        customerId: 'cus_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
      });

      // 既存の支払い方法は0件（最初の支払い方法）
      vi.mocked(mockPaymentMethodRepo.countByUserId).mockResolvedValue(0);

      // DBに保存
      vi.mocked(mockPaymentMethodRepo.create).mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        createdAt: now,
      });

      const result = await service.addPaymentMethod(testUserId, testToken);

      expect(result.brand).toBe('visa');
      expect(result.last4).toBe('4242');
      expect(result.isDefault).toBe(true);
      expect(mockPaymentGateway.setDefaultPaymentMethod).toHaveBeenCalledWith('cus_123', 'pm_external_123');
    });

    it('2番目以降の支払い方法はデフォルトにならない', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUserId,
        email: 'test@example.com',
        paymentCustomerId: 'cus_123',
      } as any);

      vi.mocked(mockPaymentGateway.attachPaymentMethod).mockResolvedValue({
        id: 'pm_external_456',
        customerId: 'cus_123',
        brand: 'mastercard',
        last4: '5555',
        expiryMonth: 6,
        expiryYear: 2025,
      });

      // 既に1件の支払い方法がある
      vi.mocked(mockPaymentMethodRepo.countByUserId).mockResolvedValue(1);

      vi.mocked(mockPaymentMethodRepo.create).mockResolvedValue({
        id: 'pm-456',
        userId: testUserId,
        externalId: 'pm_external_456',
        brand: 'mastercard',
        last4: '5555',
        expiryMonth: 6,
        expiryYear: 2025,
        isDefault: false,
        createdAt: now,
      });

      const result = await service.addPaymentMethod(testUserId, testToken);

      expect(result.isDefault).toBe(false);
      expect(mockPaymentGateway.setDefaultPaymentMethod).not.toHaveBeenCalled();
    });

    it('決済顧客IDがない場合は新規作成する', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUserId,
        email: 'test@example.com',
        paymentCustomerId: null,
      } as any);

      vi.mocked(mockPaymentGateway.createCustomer).mockResolvedValue({
        id: 'cus_new_123',
        email: 'test@example.com',
        createdAt: now,
      });

      vi.mocked(mockPaymentGateway.attachPaymentMethod).mockResolvedValue({
        id: 'pm_external_123',
        customerId: 'cus_new_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
      });

      vi.mocked(mockPaymentMethodRepo.countByUserId).mockResolvedValue(0);

      vi.mocked(mockPaymentMethodRepo.create).mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        createdAt: now,
      });

      await service.addPaymentMethod(testUserId, testToken);

      expect(mockPaymentGateway.createCustomer).toHaveBeenCalledWith('test@example.com', { userId: testUserId });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: testUserId },
        data: { paymentCustomerId: 'cus_new_123' },
      });
    });

    it('ユーザーが存在しない場合はNotFoundErrorを投げる', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.addPaymentMethod(testUserId, testToken))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('deletePaymentMethod', () => {
    it('支払い方法を削除できる', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        isDefault: false,
      });

      await service.deletePaymentMethod(testUserId, testPaymentMethodId);

      expect(mockPaymentGateway.detachPaymentMethod).toHaveBeenCalledWith('pm_external_123');
      expect(mockPaymentMethodRepo.delete).toHaveBeenCalledWith(testPaymentMethodId);
    });

    it('唯一のデフォルト支払い方法は削除できる', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        isDefault: true,
      });
      // 支払い方法が1件のみ
      vi.mocked(mockPaymentMethodRepo.countByUserId).mockResolvedValue(1);

      await service.deletePaymentMethod(testUserId, testPaymentMethodId);

      expect(mockPaymentMethodRepo.delete).toHaveBeenCalledWith(testPaymentMethodId);
    });

    it('他に支払い方法がある場合デフォルトは削除できない', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        isDefault: true,
      });
      // 支払い方法が2件ある
      vi.mocked(mockPaymentMethodRepo.countByUserId).mockResolvedValue(2);

      await expect(service.deletePaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(ValidationError);
    });

    it('支払い方法が存在しない場合はNotFoundErrorを投げる', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue(null);

      await expect(service.deletePaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('他ユーザーの支払い方法は削除できない', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue({
        id: testPaymentMethodId,
        userId: 'other-user',
        externalId: 'pm_external_123',
        isDefault: false,
      });

      await expect(service.deletePaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('デフォルト支払い方法を設定できる', async () => {
      vi.mocked(mockPaymentMethodRepo.findById)
        .mockResolvedValueOnce({
          id: testPaymentMethodId,
          userId: testUserId,
          externalId: 'pm_external_123',
          brand: 'visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2030,
          isDefault: false,
          createdAt: now,
        })
        .mockResolvedValueOnce({
          id: testPaymentMethodId,
          userId: testUserId,
          externalId: 'pm_external_123',
          brand: 'visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2030,
          isDefault: true,
          createdAt: now,
        });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUserId,
        paymentCustomerId: 'cus_123',
      } as any);

      const result = await service.setDefaultPaymentMethod(testUserId, testPaymentMethodId);

      expect(result.isDefault).toBe(true);
      expect(mockPaymentGateway.setDefaultPaymentMethod).toHaveBeenCalledWith('cus_123', 'pm_external_123');
      expect(mockPaymentMethodRepo.setDefaultForUser).toHaveBeenCalledWith(testUserId, testPaymentMethodId);
    });

    it('既にデフォルトの場合は何もしない', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        createdAt: now,
      });

      const result = await service.setDefaultPaymentMethod(testUserId, testPaymentMethodId);

      expect(result.isDefault).toBe(true);
      expect(mockPaymentGateway.setDefaultPaymentMethod).not.toHaveBeenCalled();
      expect(mockPaymentMethodRepo.setDefaultForUser).not.toHaveBeenCalled();
    });

    it('支払い方法が存在しない場合はNotFoundErrorを投げる', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue(null);

      await expect(service.setDefaultPaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('他ユーザーの支払い方法は設定できない', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue({
        id: testPaymentMethodId,
        userId: 'other-user',
        externalId: 'pm_external_123',
        isDefault: false,
      });

      await expect(service.setDefaultPaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('決済顧客情報がない場合はValidationErrorを投げる', async () => {
      vi.mocked(mockPaymentMethodRepo.findById).mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        isDefault: false,
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: testUserId,
        paymentCustomerId: null,
      } as any);

      await expect(service.setDefaultPaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(ValidationError);
    });
  });
});
