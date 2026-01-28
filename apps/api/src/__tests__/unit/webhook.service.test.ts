import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebhookEvent } from '../../gateways/payment/types.js';

// vi.hoisted() でモックオブジェクトを事前定義（vi.mockのホイスティング対応）
const { mockSubscriptionRepo, mockInvoiceRepo, mockUserRepo, mockPrisma } = vi.hoisted(() => ({
  mockSubscriptionRepo: {
    findByUserId: vi.fn(),
    findByOrganizationId: vi.fn(),
    findById: vi.fn(),
    findByExternalId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsertForUser: vi.fn(),
    upsertForOrganization: vi.fn(),
    findCancelAtPeriodEnd: vi.fn(),
    findExpired: vi.fn(),
  },
  mockInvoiceRepo: {
    findByInvoiceNumber: vi.fn(),
    upsertByInvoiceNumber: vi.fn(),
  },
  mockUserRepo: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    update: vi.fn(),
    updatePlan: vi.fn(),
    softDelete: vi.fn(),
  },
  mockPrisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock('../../repositories/subscription.repository.js', () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => mockSubscriptionRepo),
}));

vi.mock('../../repositories/invoice.repository.js', () => ({
  InvoiceRepository: vi.fn().mockImplementation(() => mockInvoiceRepo),
}));

vi.mock('../../repositories/user.repository.js', () => ({
  UserRepository: vi.fn().mockImplementation(() => mockUserRepo),
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
import { WebhookService } from '../../services/webhook.service.js';

describe('WebhookService', () => {
  let service: WebhookService;

  // テスト用のサブスクリプションデータ
  const mockSubscription = {
    id: 'sub-db-1',
    userId: 'user-1',
    organizationId: null,
    externalId: 'sub_stripe_123',
    plan: 'PRO',
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    currentPeriodStart: new Date('2025-01-01'),
    currentPeriodEnd: new Date('2025-02-01'),
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WebhookService();
  });

  describe('handleEvent - invoice.paid', () => {
    it('請求書支払い完了時にInvoiceレコードをPAIDで作成する', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockSubscription);
      mockInvoiceRepo.upsertByInvoiceNumber.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-001',
            subscription: 'sub_stripe_123',
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200, // 2024-01-01
            period_end: 1706745600,   // 2024-02-01
            due_date: 1704067200,
            invoice_pdf: 'https://example.com/invoice.pdf',
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.findByExternalId).toHaveBeenCalledWith('sub_stripe_123');
      expect(mockInvoiceRepo.upsertByInvoiceNumber).toHaveBeenCalledWith('INV-001', {
        subscriptionId: 'sub-db-1',
        invoiceNumber: 'INV-001',
        amount: 1000,
        currency: 'jpy',
        status: 'PAID',
        periodStart: new Date(1704067200 * 1000),
        periodEnd: new Date(1706745600 * 1000),
        dueDate: new Date(1704067200 * 1000),
        pdfUrl: 'https://example.com/invoice.pdf',
      });
    });

    it('due_dateがnullの場合はperiod_startをdueDateとして使用する', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockSubscription);
      mockInvoiceRepo.upsertByInvoiceNumber.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-001',
            subscription: 'sub_stripe_123',
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: null,
            invoice_pdf: null,
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockInvoiceRepo.upsertByInvoiceNumber).toHaveBeenCalledWith('INV-001',
        expect.objectContaining({
          dueDate: new Date(1704067200 * 1000),
        }),
      );
    });

    it('サブスクリプションが見つからない場合はスキップする', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);

      const event: WebhookEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-001',
            subscription: 'sub_unknown',
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: null,
            invoice_pdf: null,
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockInvoiceRepo.upsertByInvoiceNumber).not.toHaveBeenCalled();
    });

    it('subscriptionが無いinvoiceイベントはスキップする', async () => {
      const event: WebhookEvent = {
        id: 'evt_1',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'inv_1',
            number: 'INV-001',
            subscription: null,
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'paid',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: null,
            invoice_pdf: null,
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.findByExternalId).not.toHaveBeenCalled();
      expect(mockInvoiceRepo.upsertByInvoiceNumber).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - invoice.payment_failed', () => {
    it('支払い失敗時にトランザクションでInvoice作成とサブスクリプション更新を実行する', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockSubscription);
      // $transactionはコールバック関数を受け取って実行する
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
        const mockTx = {
          invoice: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          subscription: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        await fn(mockTx);
        return mockTx;
      });

      const event: WebhookEvent = {
        id: 'evt_2',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_2',
            number: 'INV-002',
            subscription: 'sub_stripe_123',
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'open',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: 1704067200,
            invoice_pdf: null,
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      // トランザクションが呼ばれたことを確認
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockSubscriptionRepo.findByExternalId).toHaveBeenCalledWith('sub_stripe_123');
    });

    it('サブスクリプションが見つからない場合はスキップする', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);

      const event: WebhookEvent = {
        id: 'evt_2',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv_2',
            number: 'INV-002',
            subscription: 'sub_unknown',
            customer: 'cus_1',
            amount_due: 1000,
            currency: 'jpy',
            status: 'open',
            period_start: 1704067200,
            period_end: 1706745600,
            due_date: null,
            invoice_pdf: null,
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - customer.subscription.created', () => {
    it('既存のサブスクリプションがある場合はスキップする', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockSubscription);

      const event: WebhookEvent = {
        id: 'evt_3',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_123',
            customer: 'cus_1',
            status: 'active',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {
              plan: 'PRO',
              billingCycle: 'MONTHLY',
              userId: 'user-1',
            },
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.upsertForUser).not.toHaveBeenCalled();
    });

    it('未登録のサブスクリプションはDBに作成する', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);
      mockSubscriptionRepo.upsertForUser.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_3',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_new',
            customer: 'cus_1',
            status: 'active',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {
              plan: 'PRO',
              billingCycle: 'MONTHLY',
              userId: 'user-1',
            },
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.upsertForUser).toHaveBeenCalledWith('user-1', {
        externalId: 'sub_stripe_new',
        plan: 'PRO',
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(1704067200 * 1000),
        currentPeriodEnd: new Date(1706745600 * 1000),
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      });
    });

    it('metadataにuserIdが無い場合はスキップする', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);

      const event: WebhookEvent = {
        id: 'evt_3',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_new',
            customer: 'cus_1',
            status: 'active',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {
              plan: 'PRO',
              billingCycle: 'MONTHLY',
            },
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.upsertForUser).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - customer.subscription.updated', () => {
    it('サブスクリプション情報をDBに同期する', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockSubscription);
      mockSubscriptionRepo.update.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_4',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_123',
            customer: 'cus_1',
            status: 'active',
            cancel_at_period_end: true,
            items: {
              data: [{
                current_period_start: 1706745600,
                current_period_end: 1709424000,
              }],
            },
            metadata: {
              plan: 'PRO',
              billingCycle: 'YEARLY',
            },
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-db-1', {
        plan: 'PRO',
        billingCycle: 'YEARLY',
        status: 'ACTIVE',
        currentPeriodStart: new Date(1706745600 * 1000),
        currentPeriodEnd: new Date(1709424000 * 1000),
        cancelAtPeriodEnd: true,
      });
    });

    it('サブスクリプションが見つからない場合はスキップする', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);

      const event: WebhookEvent = {
        id: 'evt_4',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_unknown',
            customer: 'cus_1',
            status: 'active',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1706745600,
                current_period_end: 1709424000,
              }],
            },
            metadata: {},
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - customer.subscription.deleted', () => {
    it('サブスクリプションをCANCELEDにし、ユーザープランをFREEに更新する', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockSubscription);
      mockSubscriptionRepo.update.mockResolvedValue({});
      mockUserRepo.updatePlan.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_5',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_stripe_123',
            customer: 'cus_1',
            status: 'canceled',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {},
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-db-1', {
        status: 'CANCELED',
      });
      expect(mockUserRepo.updatePlan).toHaveBeenCalledWith('user-1', 'FREE');
    });

    it('サブスクリプションが見つからない場合はスキップする', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);

      const event: WebhookEvent = {
        id: 'evt_5',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_unknown',
            customer: 'cus_1',
            status: 'canceled',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {},
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.update).not.toHaveBeenCalled();
      expect(mockUserRepo.updatePlan).not.toHaveBeenCalled();
    });

    it('userIdが無いサブスクリプション削除時はユーザー更新をスキップする', async () => {
      const subWithoutUser = { ...mockSubscription, userId: null };
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(subWithoutUser);
      mockSubscriptionRepo.update.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_5',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_stripe_123',
            customer: 'cus_1',
            status: 'canceled',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {},
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-db-1', {
        status: 'CANCELED',
      });
      expect(mockUserRepo.updatePlan).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 組織サブスクリプション - handleSubscriptionCreated
  // ============================================

  describe('handleEvent - customer.subscription.created (organization)', () => {
    it('metadataにorganizationIdがある場合は組織用として処理', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);
      mockSubscriptionRepo.upsertForOrganization.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_org_1',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_org_new',
            customer: 'cus_org_1',
            status: 'active',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {
              plan: 'TEAM',
              billingCycle: 'MONTHLY',
              organizationId: 'org-1',
            },
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.upsertForOrganization).toHaveBeenCalledWith('org-1', {
        externalId: 'sub_stripe_org_new',
        plan: 'TEAM',
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(1704067200 * 1000),
        currentPeriodEnd: new Date(1706745600 * 1000),
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      });
      expect(mockSubscriptionRepo.upsertForUser).not.toHaveBeenCalled();
    });

    it('upsertForOrganization が呼ばれる', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);
      mockSubscriptionRepo.upsertForOrganization.mockResolvedValue({
        id: 'sub-org-123',
        organizationId: 'org-1',
        plan: 'TEAM',
      });

      const event: WebhookEvent = {
        id: 'evt_org_2',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_org_2',
            customer: 'cus_org_1',
            status: 'active',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {
              plan: 'TEAM',
              billingCycle: 'YEARLY',
              organizationId: 'org-2',
            },
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.upsertForOrganization).toHaveBeenCalledTimes(1);
      expect(mockSubscriptionRepo.upsertForOrganization).toHaveBeenCalledWith('org-2', expect.objectContaining({
        plan: 'TEAM',
        billingCycle: 'YEARLY',
      }));
    });

    it('organizationIdとuserId両方ある場合はorganizationIdを優先', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(null);
      mockSubscriptionRepo.upsertForOrganization.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_org_3',
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_stripe_both',
            customer: 'cus_1',
            status: 'active',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {
              plan: 'TEAM',
              billingCycle: 'MONTHLY',
              userId: 'user-1',
              organizationId: 'org-1',
            },
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      // organizationIdを優先するので upsertForOrganization が呼ばれる
      expect(mockSubscriptionRepo.upsertForOrganization).toHaveBeenCalledWith('org-1', expect.any(Object));
      // upsertForUser は呼ばれない
      expect(mockSubscriptionRepo.upsertForUser).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 組織サブスクリプション - handleSubscriptionUpdated
  // ============================================

  describe('handleEvent - customer.subscription.updated (organization)', () => {
    const mockOrgSubscription = {
      id: 'sub-org-db-1',
      userId: null,
      organizationId: 'org-1',
      externalId: 'sub_stripe_org_123',
      plan: 'TEAM',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('組織サブスクリプションの情報をDBに同期', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockOrgSubscription);
      mockSubscriptionRepo.update.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_org_update_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_stripe_org_123',
            customer: 'cus_org_1',
            status: 'active',
            cancel_at_period_end: true,
            items: {
              data: [{
                current_period_start: 1706745600,
                current_period_end: 1738368000,
              }],
            },
            metadata: {
              plan: 'TEAM',
              billingCycle: 'YEARLY',
            },
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-org-db-1', {
        plan: 'TEAM',
        billingCycle: 'YEARLY',
        status: 'ACTIVE',
        currentPeriodStart: new Date(1706745600 * 1000),
        currentPeriodEnd: new Date(1738368000 * 1000),
        cancelAtPeriodEnd: true,
      });
    });
  });

  // ============================================
  // 組織サブスクリプション - handleSubscriptionDeleted
  // ============================================

  describe('handleEvent - customer.subscription.deleted (organization)', () => {
    const mockOrgSubscription = {
      id: 'sub-org-db-1',
      userId: null,
      organizationId: 'org-1',
      externalId: 'sub_stripe_org_123',
      plan: 'TEAM',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('組織サブスクリプションをCANCELEDにする', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockOrgSubscription);
      mockSubscriptionRepo.update.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_org_delete_1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_stripe_org_123',
            customer: 'cus_org_1',
            status: 'canceled',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {},
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith('sub-org-db-1', {
        status: 'CANCELED',
      });
    });

    it('organizationIdがある場合はUser.plan更新をスキップ', async () => {
      mockSubscriptionRepo.findByExternalId.mockResolvedValue(mockOrgSubscription);
      mockSubscriptionRepo.update.mockResolvedValue({});

      const event: WebhookEvent = {
        id: 'evt_org_delete_2',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_stripe_org_123',
            customer: 'cus_org_1',
            status: 'canceled',
            cancel_at_period_end: false,
            items: {
              data: [{
                current_period_start: 1704067200,
                current_period_end: 1706745600,
              }],
            },
            metadata: {},
          },
        },
        createdAt: new Date(),
      };

      await service.handleEvent(event);

      // 組織サブスクリプションなのでユーザープラン更新は呼ばれない
      expect(mockUserRepo.updatePlan).not.toHaveBeenCalled();
    });
  });
});
