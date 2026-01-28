import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NotFoundError, ValidationError } from '@agentest/shared';

/**
 * モック型定義
 */
interface MockSubscriptionRepo {
  findByOrganizationId: Mock;
  upsertForOrganization: Mock;
  update: Mock;
}

interface MockPaymentMethodRepo {
  findById: Mock;
}

interface MockPaymentGateway {
  createCustomer: Mock;
  createOrgSubscription: Mock;
  updateOrgSubscription: Mock;
  cancelSubscription: Mock;
  reactivateSubscription: Mock;
  updateSubscriptionQuantity: Mock;
  previewProration: Mock;
}

// vi.hoistedでモックインスタンスを作成（vi.mockより先に初期化される）
const { mockSubscriptionRepo, mockPaymentMethodRepo, mockPaymentGateway, mockPrisma } = vi.hoisted(() => ({
  mockSubscriptionRepo: {
    findByOrganizationId: vi.fn(),
    upsertForOrganization: vi.fn(),
    update: vi.fn(),
  } as MockSubscriptionRepo,
  mockPaymentMethodRepo: {
    findById: vi.fn(),
  } as MockPaymentMethodRepo,
  mockPaymentGateway: {
    createCustomer: vi.fn(),
    createOrgSubscription: vi.fn(),
    updateOrgSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    reactivateSubscription: vi.fn(),
    updateSubscriptionQuantity: vi.fn(),
    previewProration: vi.fn(),
  } as MockPaymentGateway,
  mockPrisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

// リポジトリとゲートウェイのモック
vi.mock('../../repositories/subscription.repository.js', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => mockSubscriptionRepo),
}));

vi.mock('../../repositories/payment-method.repository.js', () => ({
  PaymentMethodRepository: vi.fn().mockImplementation(() => mockPaymentMethodRepo),
}));

vi.mock('../../gateways/payment/index.js', () => ({
  getPaymentGateway: vi.fn().mockImplementation(() => mockPaymentGateway),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// モック設定後にインポート
import { OrganizationSubscriptionService } from '../../services/organization-subscription.service.js';

describe('OrganizationSubscriptionService', () => {
  let service: OrganizationSubscriptionService;
  const testOrgId = 'org-123';
  const testPaymentMethodId = 'pm-123';

  // テスト用の日付（beforeEachで再計算）
  let now: Date;
  let periodEnd: Date;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrganizationSubscriptionService();
    // 日付をテストごとに再計算
    now = new Date();
    periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
  });

  describe('getSubscription', () => {
    it('組織のサブスクリプションを取得できる', async () => {
      const mockSubscription = {
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);
      mockPrisma.organizationMember.count.mockResolvedValue(5);

      const result = await service.getSubscription(testOrgId);

      expect(mockSubscriptionRepo.findByOrganizationId).toHaveBeenCalledWith(testOrgId);
      expect(result).toEqual({
        id: 'sub-123',
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        quantity: 5,
      });
    });

    it('サブスクリプションが存在しない場合はnullを返す', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);

      const result = await service.getSubscription(testOrgId);

      expect(result).toBeNull();
    });

    it('メンバー数(quantity)がレスポンスに含まれる', async () => {
      const mockSubscription = {
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);
      mockPrisma.organizationMember.count.mockResolvedValue(10);

      const result = await service.getSubscription(testOrgId);

      expect(result?.quantity).toBe(10);
    });
  });

  describe('createSubscription', () => {
    const createInput = {
      plan: 'TEAM' as const,
      billingCycle: 'MONTHLY' as const,
      paymentMethodId: testPaymentMethodId,
    };

    it('TEAMプラン新規登録に成功する', async () => {
      // 既存サブスクリプションなし
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);

      // 支払い方法が存在する
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
      });

      // 組織が存在する
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        name: 'Test Org',
        billingEmail: 'billing@example.com',
        paymentCustomerId: null,
      });

      // メンバー数
      mockPrisma.organizationMember.count.mockResolvedValue(3);

      // 顧客作成
      mockPaymentGateway.createCustomer.mockResolvedValue({
        id: 'cus_123',
        email: 'billing@example.com',
        createdAt: now,
      });

      // サブスクリプション作成
      mockPaymentGateway.createOrgSubscription.mockResolvedValue({
        id: 'sub_external_123',
        customerId: 'cus_123',
        status: 'active',
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      // DB保存
      mockSubscriptionRepo.upsertForOrganization.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        externalId: 'sub_external_123',
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      mockPrisma.organization.update.mockResolvedValue({});

      const result = await service.createSubscription(testOrgId, createInput);

      expect(result.plan).toBe('TEAM');
      expect(result.billingCycle).toBe('MONTHLY');
      expect(result.quantity).toBe(3);
      expect(mockPaymentGateway.createOrgSubscription).toHaveBeenCalled();
      expect(mockSubscriptionRepo.upsertForOrganization).toHaveBeenCalled();
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: testOrgId },
        data: { plan: 'TEAM' },
      });
    });

    it('既にアクティブなサブスクリプションがある場合はValidationError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        status: 'ACTIVE',
      });

      await expect(service.createSubscription(testOrgId, createInput))
        .rejects.toThrow(ValidationError);
    });

    it('PAST_DUEステータスでもサブスクリプション作成を拒否する', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        status: 'PAST_DUE',
      });

      await expect(service.createSubscription(testOrgId, createInput))
        .rejects.toThrow(ValidationError);
    });

    it('支払い方法が存在しない場合はNotFoundError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue(null);

      await expect(service.createSubscription(testOrgId, createInput))
        .rejects.toThrow(NotFoundError);
    });

    it('他組織の支払い方法を指定した場合はNotFoundError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: 'other-org',
        externalId: 'pm_external_123',
      });

      await expect(service.createSubscription(testOrgId, createInput))
        .rejects.toThrow(NotFoundError);
    });

    it('組織にメンバーが存在しない場合はValidationError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
        paymentCustomerId: 'cus_123',
      });
      mockPrisma.organizationMember.count.mockResolvedValue(0);

      await expect(service.createSubscription(testOrgId, createInput))
        .rejects.toThrow(ValidationError);
    });

    it('決済顧客IDがない場合は新規作成する（ensureOrgPaymentCustomer）', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
        paymentCustomerId: null,
      });
      mockPrisma.organizationMember.count.mockResolvedValue(2);
      mockPaymentGateway.createCustomer.mockResolvedValue({
        id: 'cus_new_123',
        email: 'billing@example.com',
        createdAt: now,
      });
      mockPaymentGateway.createOrgSubscription.mockResolvedValue({
        id: 'sub_external_123',
        customerId: 'cus_new_123',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      mockSubscriptionRepo.upsertForOrganization.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      await service.createSubscription(testOrgId, createInput);

      expect(mockPaymentGateway.createCustomer).toHaveBeenCalledWith('billing@example.com', { organizationId: testOrgId });
      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: testOrgId },
        data: { paymentCustomerId: 'cus_new_123' },
      });
    });

    it('billingEmailがない場合はOWNERのemailをフォールバック', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: null,
        paymentCustomerId: null,
      });
      mockPrisma.organizationMember.findFirst.mockResolvedValue({
        userId: 'owner-user',
        role: 'OWNER',
        user: { email: 'owner@example.com' },
      });
      mockPrisma.organizationMember.count.mockResolvedValue(1);
      mockPaymentGateway.createCustomer.mockResolvedValue({
        id: 'cus_123',
        email: 'owner@example.com',
        createdAt: now,
      });
      mockPaymentGateway.createOrgSubscription.mockResolvedValue({
        id: 'sub_external_123',
        customerId: 'cus_123',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      mockSubscriptionRepo.upsertForOrganization.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      await service.createSubscription(testOrgId, createInput);

      expect(mockPaymentGateway.createCustomer).toHaveBeenCalledWith('owner@example.com', { organizationId: testOrgId });
    });

    it('billingEmailもOWNERもない場合はValidationError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: null,
        paymentCustomerId: null,
      });
      mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

      await expect(service.createSubscription(testOrgId, createInput))
        .rejects.toThrow(ValidationError);
    });

    it('組織のplanがTEAMに更新される', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        organizationId: testOrgId,
        externalId: 'pm_external_123',
      });
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: testOrgId,
        billingEmail: 'billing@example.com',
        paymentCustomerId: 'cus_123',
      });
      mockPrisma.organizationMember.count.mockResolvedValue(2);
      mockPaymentGateway.createOrgSubscription.mockResolvedValue({
        id: 'sub_external_123',
        customerId: 'cus_123',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      mockSubscriptionRepo.upsertForOrganization.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      await service.createSubscription(testOrgId, createInput);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: testOrgId },
        data: { plan: 'TEAM' },
      });
    });
  });

  describe('updateSubscription', () => {
    it('請求サイクルをMONTHLY→YEARLYに変更できる', async () => {
      const mockSubscription = {
        id: 'sub-123',
        organizationId: testOrgId,
        externalId: 'sub_external_123',
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);
      mockPrisma.organizationMember.count.mockResolvedValue(3);
      mockPaymentGateway.updateOrgSubscription.mockResolvedValue({
        id: 'sub_external_123',
        status: 'active',
        billingCycle: 'YEARLY',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      });
      mockSubscriptionRepo.update.mockResolvedValue({
        ...mockSubscription,
        billingCycle: 'YEARLY',
      });

      const result = await service.updateSubscription(testOrgId, { billingCycle: 'YEARLY' });

      expect(result.billingCycle).toBe('YEARLY');
      expect(mockPaymentGateway.updateOrgSubscription).toHaveBeenCalledWith(
        'sub_external_123',
        { billingCycle: 'YEARLY', quantity: 3 }
      );
    });

    it('サブスクリプションが存在しない場合はNotFoundError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);

      await expect(service.updateSubscription(testOrgId, { billingCycle: 'YEARLY' }))
        .rejects.toThrow(NotFoundError);
    });

    it('externalIdがない場合はValidationError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        externalId: null,
        plan: 'TEAM',
        status: 'ACTIVE',
      });

      await expect(service.updateSubscription(testOrgId, { billingCycle: 'YEARLY' }))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('cancelSubscription', () => {
    it('キャンセル予約に成功する（cancelAtPeriodEnd=true）', async () => {
      const mockSubscription = {
        id: 'sub-123',
        organizationId: testOrgId,
        externalId: 'sub_external_123',
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);
      mockPaymentGateway.cancelSubscription.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });
      mockSubscriptionRepo.update.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });
      mockPrisma.organizationMember.count.mockResolvedValue(3);

      const result = await service.cancelSubscription(testOrgId);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockPaymentGateway.cancelSubscription).toHaveBeenCalledWith('sub_external_123', true);
      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-123', { cancelAtPeriodEnd: true });
    });

    it('サブスクリプションが存在しない場合はNotFoundError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);

      await expect(service.cancelSubscription(testOrgId))
        .rejects.toThrow(NotFoundError);
    });

    it('既にキャンセル予約されている場合はValidationError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      });

      await expect(service.cancelSubscription(testOrgId))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('reactivateSubscription', () => {
    it('キャンセル予約の解除に成功する', async () => {
      const mockSubscription = {
        id: 'sub-123',
        organizationId: testOrgId,
        externalId: 'sub_external_123',
        plan: 'TEAM',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        cancelAtPeriodEnd: true,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      };
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(mockSubscription);
      mockPaymentGateway.reactivateSubscription.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: false,
      });
      mockSubscriptionRepo.update.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: false,
      });
      mockPrisma.organizationMember.count.mockResolvedValue(3);

      const result = await service.reactivateSubscription(testOrgId);

      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(mockPaymentGateway.reactivateSubscription).toHaveBeenCalledWith('sub_external_123');
    });

    it('サブスクリプションが存在しない場合はNotFoundError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);

      await expect(service.reactivateSubscription(testOrgId))
        .rejects.toThrow(NotFoundError);
    });

    it('キャンセル予約されていない場合はValidationError', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        plan: 'TEAM',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      });

      await expect(service.reactivateSubscription(testOrgId))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('syncMemberCount', () => {
    it('Stripeのサブスクリプション数量を更新する', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        externalId: 'sub_external_123',
        plan: 'TEAM',
        status: 'ACTIVE',
      });
      mockPrisma.organizationMember.count.mockResolvedValue(5);

      await service.syncMemberCount(testOrgId);

      expect(mockPaymentGateway.updateSubscriptionQuantity).toHaveBeenCalledWith('sub_external_123', 5);
    });

    it('サブスクリプションがない場合は何もしない', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue(null);

      await service.syncMemberCount(testOrgId);

      expect(mockPaymentGateway.updateSubscriptionQuantity).not.toHaveBeenCalled();
    });

    it('externalIdがない場合は何もしない', async () => {
      mockSubscriptionRepo.findByOrganizationId.mockResolvedValue({
        id: 'sub-123',
        organizationId: testOrgId,
        externalId: null,
        plan: 'TEAM',
        status: 'ACTIVE',
      });

      await service.syncMemberCount(testOrgId);

      expect(mockPaymentGateway.updateSubscriptionQuantity).not.toHaveBeenCalled();
    });
  });

  describe('calculatePlanChange', () => {
    it('TEAMプランのMONTHLY料金を計算する', async () => {
      mockPrisma.organizationMember.count.mockResolvedValue(3);

      const result = await service.calculatePlanChange(testOrgId, 'TEAM', 'MONTHLY');

      expect(result.plan).toBe('TEAM');
      expect(result.billingCycle).toBe('MONTHLY');
      // TEAM月額は1,200円/ユーザー
      expect(result.pricePerUser).toBe(1200);
      expect(result.quantity).toBe(3);
      expect(result.totalPrice).toBe(3600);
      expect(result.currency).toBe('jpy');
    });

    it('TEAMプランのYEARLY料金を計算する', async () => {
      mockPrisma.organizationMember.count.mockResolvedValue(3);

      const result = await service.calculatePlanChange(testOrgId, 'TEAM', 'YEARLY');

      expect(result.plan).toBe('TEAM');
      expect(result.billingCycle).toBe('YEARLY');
      // TEAM年額は12,000円/ユーザー
      expect(result.pricePerUser).toBe(12000);
      expect(result.quantity).toBe(3);
      expect(result.totalPrice).toBe(36000);
    });

    it('メンバー数に応じた合計金額を計算する', async () => {
      mockPrisma.organizationMember.count.mockResolvedValue(10);

      const result = await service.calculatePlanChange(testOrgId, 'TEAM', 'MONTHLY');

      expect(result.quantity).toBe(10);
      expect(result.totalPrice).toBe(12000); // 1,200 * 10
    });
  });
});
