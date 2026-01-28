import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NotFoundError, ValidationError } from '@agentest/shared';

/**
 * モック型定義
 */
interface MockPaymentMethodRepo {
  findByOrganizationId: Mock;
  findById: Mock;
  countByOrganizationId: Mock;
  create: Mock;
  delete: Mock;
  setDefaultForOrganization: Mock;
}

interface MockPaymentGateway {
  createCustomer: Mock;
  createSetupIntent: Mock;
  attachPaymentMethod: Mock;
  detachPaymentMethod: Mock;
  setDefaultPaymentMethod: Mock;
}

// vi.hoistedでモックインスタンスを作成（vi.mockより先に初期化される）
const { mockPaymentMethodRepo, mockPaymentGateway, mockPrisma } = vi.hoisted(() => ({
  mockPaymentMethodRepo: {
    findByOrganizationId: vi.fn(),
    findById: vi.fn(),
    countByOrganizationId: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    setDefaultForOrganization: vi.fn(),
  } as MockPaymentMethodRepo,
  mockPaymentGateway: {
    createCustomer: vi.fn(),
    createSetupIntent: vi.fn(),
    attachPaymentMethod: vi.fn(),
    detachPaymentMethod: vi.fn(),
    setDefaultPaymentMethod: vi.fn(),
  } as MockPaymentGateway,
  mockPrisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findFirst: vi.fn(),
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
import { OrganizationPaymentMethodService } from '../../services/organization-payment-method.service.js';

describe('OrganizationPaymentMethodService', () => {
  let service: OrganizationPaymentMethodService;
  const testOrgId = 'org-123';
  const testPaymentMethodId = 'pm-123';

  // テスト用の日付
  let now: Date;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrganizationPaymentMethodService();
    now = new Date();
  });

  describe('createSetupIntent', () => {
    it('SetupIntentを作成しclientSecretを返す', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
        paymentCustomerId: 'cus_123',
      });
      mockPaymentGateway.createSetupIntent.mockResolvedValue({
        clientSecret: 'seti_secret_123',
      });

      const result = await service.createSetupIntent(testOrgId);

      expect(result.clientSecret).toBe('seti_secret_123');
      expect(mockPaymentGateway.createSetupIntent).toHaveBeenCalledWith('cus_123');
    });

    it('組織が存在しない場合はNotFoundError', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.createSetupIntent(testOrgId))
        .rejects.toThrow(NotFoundError);
    });

    it('決済顧客IDがない場合は新規作成する', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
        paymentCustomerId: null,
      });
      mockPaymentGateway.createCustomer.mockResolvedValue({
        id: 'cus_new_123',
        email: 'billing@example.com',
        createdAt: now,
      });
      mockPaymentGateway.createSetupIntent.mockResolvedValue({
        clientSecret: 'seti_secret_123',
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const result = await service.createSetupIntent(testOrgId);

      expect(mockPaymentGateway.createCustomer).toHaveBeenCalledWith(
        'billing@example.com',
        { organizationId: testOrgId }
      );
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: testOrgId },
        data: { paymentCustomerId: 'cus_new_123' },
      });
      expect(result.clientSecret).toBe('seti_secret_123');
    });
  });

  describe('getPaymentMethods', () => {
    it('組織の支払い方法一覧を取得できる', async () => {
      const mockPaymentMethods = [
        {
          id: 'pm-1',
          organizationId: testOrgId,
          brand: 'visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2030,
          isDefault: true,
          createdAt: now,
        },
        {
          id: 'pm-2',
          organizationId: testOrgId,
          brand: 'mastercard',
          last4: '5555',
          expiryMonth: 6,
          expiryYear: 2025,
          isDefault: false,
          createdAt: now,
        },
      ];
      mockPaymentMethodRepo.findByOrganizationId.mockResolvedValue(mockPaymentMethods);

      const result = await service.getPaymentMethods(testOrgId);

      expect(mockPaymentMethodRepo.findByOrganizationId).toHaveBeenCalledWith(testOrgId);
      expect(result).toHaveLength(2);
      expect(result[0].brand).toBe('visa');
      expect(result[0].isDefault).toBe(true);
    });

    it('支払い方法がない場合は空配列を返す', async () => {
      mockPaymentMethodRepo.findByOrganizationId.mockResolvedValue([]);

      const result = await service.getPaymentMethods(testOrgId);

      expect(result).toEqual([]);
    });
  });

  describe('addPaymentMethod', () => {
    const testToken = 'tok_visa_4242';

    it('支払い方法を追加できる', async () => {
      // 組織が存在する
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
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
      mockPaymentMethodRepo.countByOrganizationId.mockResolvedValue(0);

      // DBに保存
      mockPaymentMethodRepo.create.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        createdAt: now,
      });

      const result = await service.addPaymentMethod(testOrgId, testToken);

      expect(result.brand).toBe('visa');
      expect(result.last4).toBe('4242');
      expect(result.isDefault).toBe(true);
      expect(mockPaymentGateway.setDefaultPaymentMethod).toHaveBeenCalledWith('cus_123', 'pm_external_123');
    });

    it('最初の支払い方法はデフォルトに設定される', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
        paymentCustomerId: 'cus_123',
      });
      mockPaymentGateway.attachPaymentMethod.mockResolvedValue({
        id: 'pm_external_123',
        customerId: 'cus_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
      });
      mockPaymentMethodRepo.countByOrganizationId.mockResolvedValue(0);
      mockPaymentMethodRepo.create.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        createdAt: now,
      });

      const result = await service.addPaymentMethod(testOrgId, testToken);

      expect(result.isDefault).toBe(true);
      expect(mockPaymentGateway.setDefaultPaymentMethod).toHaveBeenCalled();
    });

    it('2番目以降の支払い方法はデフォルトにならない', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
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
      mockPaymentMethodRepo.countByOrganizationId.mockResolvedValue(1);
      mockPaymentMethodRepo.create.mockResolvedValue({
        id: 'pm-456',
        organizationId: testOrgId,
        externalId: 'pm_external_456',
        brand: 'mastercard',
        last4: '5555',
        expiryMonth: 6,
        expiryYear: 2025,
        isDefault: false,
        createdAt: now,
      });

      const result = await service.addPaymentMethod(testOrgId, testToken);

      expect(result.isDefault).toBe(false);
      expect(mockPaymentGateway.setDefaultPaymentMethod).not.toHaveBeenCalled();
    });

    it('決済顧客IDがない場合は新規作成してから追加する', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
        paymentCustomerId: null,
      });
      mockPaymentGateway.createCustomer.mockResolvedValue({
        id: 'cus_new_123',
        email: 'billing@example.com',
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
      mockPaymentMethodRepo.countByOrganizationId.mockResolvedValue(0);
      mockPaymentMethodRepo.create.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        createdAt: now,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      await service.addPaymentMethod(testOrgId, testToken);

      expect(mockPaymentGateway.createCustomer).toHaveBeenCalledWith('billing@example.com', { organizationId: testOrgId });
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: testOrgId },
        data: { paymentCustomerId: 'cus_new_123' },
      });
    });
  });

  describe('deletePaymentMethod', () => {
    it('支払い方法を削除できる', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
        isDefault: false,
      });

      await service.deletePaymentMethod(testOrgId, testPaymentMethodId);

      expect(mockPaymentGateway.detachPaymentMethod).toHaveBeenCalledWith('pm_external_123');
      expect(mockPaymentMethodRepo.delete).toHaveBeenCalledWith(testPaymentMethodId);
    });

    it('唯一のデフォルト支払い方法は削除できる', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
        isDefault: true,
      });
      // 支払い方法が1件のみ
      mockPaymentMethodRepo.countByOrganizationId.mockResolvedValue(1);

      await service.deletePaymentMethod(testOrgId, testPaymentMethodId);

      expect(mockPaymentMethodRepo.delete).toHaveBeenCalledWith(testPaymentMethodId);
    });

    it('他に支払い方法がある場合デフォルトは削除できない', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
        isDefault: true,
      });
      // 支払い方法が2件ある
      mockPaymentMethodRepo.countByOrganizationId.mockResolvedValue(2);

      await expect(service.deletePaymentMethod(testOrgId, testPaymentMethodId))
        .rejects.toThrow(ValidationError);
    });

    it('支払い方法が存在しない場合はNotFoundError', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue(null);

      await expect(service.deletePaymentMethod(testOrgId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('他組織の支払い方法は削除できない', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: 'other-org',
        externalId: 'pm_external_123',
        isDefault: false,
      });

      await expect(service.deletePaymentMethod(testOrgId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('デフォルト支払い方法を設定できる', async () => {
      mockPaymentMethodRepo.findById
        .mockResolvedValueOnce({
          id: testPaymentMethodId,
          organizationId: testOrgId,
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
          organizationId: testOrgId,
          externalId: 'pm_external_123',
          brand: 'visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2030,
          isDefault: true,
          createdAt: now,
        });

      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        paymentCustomerId: 'cus_123',
      });

      const result = await service.setDefaultPaymentMethod(testOrgId, testPaymentMethodId);

      expect(result.isDefault).toBe(true);
      expect(mockPaymentGateway.setDefaultPaymentMethod).toHaveBeenCalledWith('cus_123', 'pm_external_123');
      expect(mockPaymentMethodRepo.setDefaultForOrganization).toHaveBeenCalledWith(testOrgId, testPaymentMethodId);
    });

    it('既にデフォルトの場合は何もしない', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        createdAt: now,
      });

      const result = await service.setDefaultPaymentMethod(testOrgId, testPaymentMethodId);

      expect(result.isDefault).toBe(true);
      expect(mockPaymentGateway.setDefaultPaymentMethod).not.toHaveBeenCalled();
      expect(mockPaymentMethodRepo.setDefaultForOrganization).not.toHaveBeenCalled();
    });

    it('支払い方法が存在しない場合はNotFoundError', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue(null);

      await expect(service.setDefaultPaymentMethod(testOrgId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('他組織の支払い方法は設定できない', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: 'other-org',
        externalId: 'pm_external_123',
        isDefault: false,
      });

      await expect(service.setDefaultPaymentMethod(testOrgId, testPaymentMethodId))
        .rejects.toThrow(NotFoundError);
    });

    it('決済顧客情報がない場合はValidationError', async () => {
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
        isDefault: false,
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        paymentCustomerId: null,
      });

      await expect(service.setDefaultPaymentMethod(testOrgId, testPaymentMethodId))
        .rejects.toThrow(ValidationError);
    });
  });
});
