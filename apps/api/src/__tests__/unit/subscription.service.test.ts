import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NotFoundError, ValidationError } from '@agentest/shared';

/**
 * モック型定義
 */
interface MockSubscriptionRepo {
  findByUserId: Mock;
  findById: Mock;
  create: Mock;
  update: Mock;
  upsertForUser: Mock;
}

interface MockPaymentMethodRepo {
  findById: Mock;
  findByUserId: Mock;
  countByUserId: Mock;
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
const { mockSubscriptionRepo, mockPaymentMethodRepo, mockPaymentGateway, mockPrisma } = vi.hoisted(() => ({
  mockSubscriptionRepo: {
    findByUserId: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsertForUser: vi.fn(),
  } as MockSubscriptionRepo,
  mockPaymentMethodRepo: {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    countByUserId: vi.fn(),
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

// モック設定後にインポート
import { SubscriptionService } from '../../services/subscription.service.js';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  const testUserId = 'user-123';
  const testPaymentMethodId = 'pm-123';

  // テスト用の日付（beforeEachで再計算）
  let now: Date;
  let periodEnd: Date;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SubscriptionService();
    // 日付をテストごとに再計算
    now = new Date();
    periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
  });

  describe('getSubscription', () => {
    it('ユーザーのサブスクリプションを取得できる', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: testUserId,
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      };
      mockSubscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);

      const result = await service.getSubscription(testUserId);

      expect(mockSubscriptionRepo.findByUserId).toHaveBeenCalledWith(testUserId);
      expect(result).toEqual({
        id: 'sub-123',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });
    });

    it('サブスクリプションが存在しない場合はnullを返す', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue(null);

      const result = await service.getSubscription(testUserId);

      expect(result).toBeNull();
    });
  });

  describe('createSubscription', () => {
    const createInput = {
      plan: 'PRO' as const,
      billingCycle: 'MONTHLY' as const,
      paymentMethodId: testPaymentMethodId,
    };

    it('FREE→PROへのアップグレードに成功する', async () => {
      // 既存サブスクリプションなし
      mockSubscriptionRepo.findByUserId.mockResolvedValue(null);

      // 支払い方法が存在する
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
      });

      // ユーザーが存在する
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        email: 'test@example.com',
        paymentCustomerId: null,
      });

      // 顧客作成
      mockPaymentGateway.createCustomer.mockResolvedValue({
        id: 'cus_123',
        email: 'test@example.com',
        createdAt: now,
      });

      // サブスクリプション作成
      mockPaymentGateway.createSubscription.mockResolvedValue({
        id: 'sub_external_123',
        customerId: 'cus_123',
        status: 'active',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      // DB保存
      mockSubscriptionRepo.upsertForUser.mockResolvedValue({
        id: 'sub-123',
        userId: testUserId,
        externalId: 'sub_external_123',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.createSubscription(testUserId, createInput);

      expect(result.plan).toBe('PRO');
      expect(result.billingCycle).toBe('MONTHLY');
      expect(mockPaymentGateway.createSubscription).toHaveBeenCalled();
      expect(mockSubscriptionRepo.upsertForUser).toHaveBeenCalled();
    });

    it('既にPROプランに加入している場合はValidationErrorを投げる', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue({
        id: 'sub-123',
        userId: testUserId,
        plan: 'PRO',
        status: 'ACTIVE',
      });

      await expect(service.createSubscription(testUserId, createInput))
        .rejects.toThrow(ValidationError);
    });

    it('支払い方法が存在しない場合はNotFoundErrorを投げる', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue(null);

      await expect(service.createSubscription(testUserId, createInput))
        .rejects.toThrow(NotFoundError);
    });

    it('他ユーザーの支払い方法を指定した場合はNotFoundErrorを投げる', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        userId: 'other-user',
        externalId: 'pm_external_123',
      });

      await expect(service.createSubscription(testUserId, createInput))
        .rejects.toThrow(NotFoundError);
    });

    it('ユーザーが存在しない場合はNotFoundErrorを投げる', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue(null);
      mockPaymentMethodRepo.findById.mockResolvedValue({
        id: testPaymentMethodId,
        userId: testUserId,
        externalId: 'pm_external_123',
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.createSubscription(testUserId, createInput))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('cancelSubscription', () => {
    it('PRO→FREEへのダウングレード予約に成功する', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: testUserId,
        externalId: 'sub_external_123',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      };
      mockSubscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      mockPaymentGateway.cancelSubscription.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });
      mockSubscriptionRepo.update.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });

      const result = await service.cancelSubscription(testUserId);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockPaymentGateway.cancelSubscription).toHaveBeenCalledWith('sub_external_123', true);
      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-123', { cancelAtPeriodEnd: true });
    });

    it('サブスクリプションが存在しない場合はNotFoundErrorを投げる', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(service.cancelSubscription(testUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('FREEプランはキャンセルできない', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue({
        id: 'sub-123',
        userId: testUserId,
        plan: 'FREE',
        status: 'ACTIVE',
      });

      await expect(service.cancelSubscription(testUserId))
        .rejects.toThrow(ValidationError);
    });

    it('既にキャンセル予約されている場合はValidationErrorを投げる', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue({
        id: 'sub-123',
        userId: testUserId,
        plan: 'PRO',
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      });

      await expect(service.cancelSubscription(testUserId))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('reactivateSubscription', () => {
    it('ダウングレード予約のキャンセルに成功する', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: testUserId,
        externalId: 'sub_external_123',
        plan: 'PRO',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        cancelAtPeriodEnd: true,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      };
      mockSubscriptionRepo.findByUserId.mockResolvedValue(mockSubscription);
      mockPaymentGateway.reactivateSubscription.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: false,
      });
      mockSubscriptionRepo.update.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: false,
      });

      const result = await service.reactivateSubscription(testUserId);

      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(mockPaymentGateway.reactivateSubscription).toHaveBeenCalledWith('sub_external_123');
    });

    it('サブスクリプションが存在しない場合はNotFoundErrorを投げる', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue(null);

      await expect(service.reactivateSubscription(testUserId))
        .rejects.toThrow(NotFoundError);
    });

    it('キャンセル予約されていない場合はValidationErrorを投げる', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue({
        id: 'sub-123',
        userId: testUserId,
        plan: 'PRO',
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      });

      await expect(service.reactivateSubscription(testUserId))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('calculatePlanChange', () => {
    it('新規サブスクリプションの場合は単純な価格を返す', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue(null);

      const result = await service.calculatePlanChange(testUserId, 'PRO', 'MONTHLY');

      expect(result.plan).toBe('PRO');
      expect(result.billingCycle).toBe('MONTHLY');
      expect(result.price).toBe(980);
      expect(result.currency).toBe('jpy');
      expect(result.prorationAmount).toBeUndefined();
    });

    it('FREEプランからの場合は単純な価格を返す', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue({
        id: 'sub-123',
        userId: testUserId,
        plan: 'FREE',
        status: 'ACTIVE',
      });

      const result = await service.calculatePlanChange(testUserId, 'PRO', 'YEARLY');

      expect(result.plan).toBe('PRO');
      expect(result.billingCycle).toBe('YEARLY');
      expect(result.price).toBe(9800);
    });

    it('既存PROサブスクリプションがあり決済顧客IDがある場合は日割り計算を行う', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue({
        id: 'sub-123',
        userId: testUserId,
        externalId: 'sub_external_123',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        paymentCustomerId: 'cus_123',
      });
      mockPaymentGateway.previewProration.mockResolvedValue({
        amountDue: 4000,
        currency: 'jpy',
        effectiveDate: now,
      });

      const result = await service.calculatePlanChange(testUserId, 'PRO', 'YEARLY');

      expect(result.prorationAmount).toBe(4000);
      expect(mockPaymentGateway.previewProration).toHaveBeenCalled();
    });

    it('日割り計算に失敗した場合は単純な価格を返す', async () => {
      mockSubscriptionRepo.findByUserId.mockResolvedValue({
        id: 'sub-123',
        userId: testUserId,
        externalId: 'sub_external_123',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: testUserId,
        paymentCustomerId: 'cus_123',
      });
      mockPaymentGateway.previewProration.mockRejectedValue(new Error('Gateway error'));

      const result = await service.calculatePlanChange(testUserId, 'PRO', 'YEARLY');

      expect(result.price).toBe(9800);
      expect(result.prorationAmount).toBeUndefined();
    });
  });
});
