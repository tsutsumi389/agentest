import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NotFoundError, ValidationError } from '@agentest/shared';

/**
 * モック型定義
 */
interface MockPaymentMethodRepo {
  findByUserId: Mock;
  findById: Mock;
  countByUserId: Mock;
  create: Mock;
  delete: Mock;
  setDefaultForUser: Mock;
}

interface MockPaymentGateway {
  createCustomer: Mock;
  getCustomer: Mock;
  attachPaymentMethod: Mock;
  detachPaymentMethod: Mock;
  listPaymentMethods: Mock;
  setDefaultPaymentMethod: Mock;
  createSubscription: Mock;
  updateSubscription: Mock;
  cancelSubscription: Mock;
  reactivateSubscription: Mock;
  previewProration: Mock;
  getInvoice: Mock;
  listInvoices: Mock;
  getInvoicePdf: Mock;
  verifyWebhookSignature: Mock;
  parseWebhookEvent: Mock;
}

// vi.hoistedでモックインスタンスを作成（vi.mockより先に初期化される）
const { mockPaymentMethodRepo, mockPaymentGateway, mockPrisma } = vi.hoisted(() => ({
  mockPaymentMethodRepo: {
    findByUserId: vi.fn(),
    findById: vi.fn(),
    countByUserId: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    setDefaultForUser: vi.fn(),
  } as MockPaymentMethodRepo,
  mockPaymentGateway: {
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
  } as MockPaymentGateway,
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// リポジトリとゲートウェイのモック
vi.mock('../../repositories/payment-method.repository.js', () => ({
  PaymentMethodRepository: vi.fn().mockImplementation(() => mockPaymentMethodRepo),
}));

vi.mock('../../gateways/payment/index.js', () => ({
  getPaymentGateway: vi.fn().mockImplementation(() => mockPaymentGateway),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// モック設定後にインポート
import { PaymentMethodService } from '../../services/payment-method.service.js';

describe('PaymentMethodService', () => {
  let service: PaymentMethodService;
  const testUserId = 'user-123';
  const testPaymentMethodId = 'pm-123';

  // テスト用の日付（beforeEachで再計算）
  let now: Date;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentMethodService();
    now = new Date();
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
      mockPaymentMethodRepo.findByUserId.mockResolvedValue(mockPaymentMethods);

      const result = await service.getPaymentMethods(testUserId);

      expect(mockPaymentMethodRepo.findByUserId).toHaveBeenCalledWith(testUserId);
      expect(result).toHaveLength(2);
      expect(result[0].brand).toBe('visa');
      expect(result[0].isDefault).toBe(true);
    });

    it('支払い方法が存在しない場合は空配列を返す', async () => {
      mockPaymentMethodRepo.findByUserId.mockResolvedValue([]);

      const result = await service.getPaymentMethods(testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('addPaymentMethod', () => {
    const testToken = 'tok_visa_4242';

    it('支払い方法を追加できる', async () => {
      // ユーザーが存在する
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: 'test@example.com',
        paymentCustomerId: 'cus_123',
      });

      // 決済ゲートウェイに支払い方法を紐付け
      mockPaymentGateway.attachPaymentMethod.mockResolvedValue({
        id: 'pm_external_123',
        customerId: 'cus_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
      });

      // 既存の支払い方法は0件（最初の支払い方法）
      mockPaymentMethodRepo.countByUserId.mockResolvedValue(0);

      // DBに保存
      mockPaymentMethodRepo.create.mockResolvedValue({
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
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: 'test@example.com',
        paymentCustomerId: 'cus_123',
      });

      mockPaymentGateway.attachPaymentMethod.mockResolvedValue({
        id: 'pm_external_456',
        customerId: 'cus_123',
        brand: 'mastercard',
        last4: '5555',
        expiryMonth: 6,
        expiryYear: 2025,
      });

      // 既に1件の支払い方法がある
      mockPaymentMethodRepo.countByUserId.mockResolvedValue(1);

      mockPaymentMethodRepo.create.mockResolvedValue({
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
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: 'test@example.com',
        paymentCustomerId: null,
      });

      mockPaymentGateway.createCustomer.mockResolvedValue({
        id: 'cus_new_123',
        email: 'test@example.com',
        createdAt: now,
      });

      mockPaymentGateway.attachPaymentMethod.mockResolvedValue({
        id: 'pm_external_123',
        customerId: 'cus_new_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
      });

      mockPaymentMethodRepo.countByUserId.mockResolvedValue(0);

      mockPaymentMethodRepo.create.mockResolvedValue({
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
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: testUserId },
        data: { paymentCustomerId: 'cus_new_123' },
      });
    });

    it('ユーザーが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.addPaymentMethod(testUserId, testToken))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('deletePaymentMethod', () => {
    it('支払い方法を削除できる', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
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
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        isDefault: true,
      });
      // 支払い方法が1件のみ
      mockPaymentMethodRepo.countByUserId.mockResolvedValue(1);

      await service.deletePaymentMethod(testUserId, testPaymentMethodId);

      expect(mockPaymentMethodRepo.delete).toHaveBeenCalledWith(testPaymentMethodId);
    });

    it('他に支払い方法がある場合デフォルトは削除できない', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        isDefault: true,
      });
      // 支払い方法が2件ある
      mockPaymentMethodRepo.countByUserId.mockResolvedValue(2);

      await expect(service.deletePaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(ValidationError);
    });

    it('支払い方法が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue(null);

      await expect(service.deletePaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('他ユーザーの支払い方法は削除できない', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
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
      mockPaymentMethodRepo.findById
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

      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        paymentCustomerId: 'cus_123',
      });

      const result = await service.setDefaultPaymentMethod(testUserId, testPaymentMethodId);

      expect(result.isDefault).toBe(true);
      expect(mockPaymentGateway.setDefaultPaymentMethod).toHaveBeenCalledWith('cus_123', 'pm_external_123');
      expect(mockPaymentMethodRepo.setDefaultForUser).toHaveBeenCalledWith(testUserId, testPaymentMethodId);
    });

    it('既にデフォルトの場合は何もしない', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
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
      mockPaymentMethodRepo.findById.mockResolvedValue(null);

      await expect(service.setDefaultPaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('他ユーザーの支払い方法は設定できない', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        userId: 'other-user',
        externalId: 'pm_external_123',
        isDefault: false,
      });

      await expect(service.setDefaultPaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('決済顧客情報がない場合はValidationErrorを投げる', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
        isDefault: false,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        paymentCustomerId: null,
      });

      await expect(service.setDefaultPaymentMethod(testUserId, testPaymentMethodId))
        .rejects.toThrow(ValidationError);
    });
  });
});
