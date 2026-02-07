/**
 * 組織サブスクリプションサービス
 * 組織のサブスクリプション管理を担当
 */

import { prisma, type Subscription } from '@agentest/db';
import {
  NotFoundError,
  ValidationError,
  type BillingCycle,
  type OrgPlan,
  ORG_PLAN_PRICING,
} from '@agentest/shared';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { PaymentMethodRepository } from '../repositories/payment-method.repository.js';
import { getPaymentGateway } from '../gateways/payment/index.js';
import type { IPaymentGateway } from '../gateways/payment/payment-gateway.interface.js';
import { logger } from '../utils/logger.js';

/**
 * 組織サブスクリプション作成パラメータ
 */
export interface CreateOrgSubscriptionInput {
  plan: 'TEAM';
  billingCycle: BillingCycle;
  paymentMethodId: string;
}

/**
 * 組織サブスクリプション更新パラメータ
 */
export interface UpdateOrgSubscriptionInput {
  billingCycle: BillingCycle;
}

/**
 * 組織向け料金計算結果
 */
export interface OrgPlanChangeCalculation {
  plan: OrgPlan;
  billingCycle: BillingCycle;
  pricePerUser: number;
  quantity: number;
  totalPrice: number;
  currency: string;
  effectiveDate: Date;
}

/**
 * 組織サブスクリプションレスポンス
 */
export interface OrgSubscriptionResponse {
  id: string;
  plan: OrgPlan;
  billingCycle: BillingCycle;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  quantity: number;
}

/**
 * 組織サブスクリプションサービス
 */
export class OrganizationSubscriptionService {
  private subscriptionRepo = new SubscriptionRepository();
  private paymentMethodRepo = new PaymentMethodRepository();
  private paymentGateway: IPaymentGateway;

  constructor() {
    this.paymentGateway = getPaymentGateway();
  }

  /**
   * 組織のサブスクリプションを取得
   */
  async getSubscription(orgId: string): Promise<OrgSubscriptionResponse | null> {
    const subscription = await this.subscriptionRepo.findByOrganizationId(orgId);
    if (!subscription) {
      return null;
    }

    const quantity = await this.getMemberCount(orgId);
    return this.toResponse(subscription, quantity);
  }

  /**
   * サブスクリプションを作成（TEAM プランへのアップグレード）
   */
  async createSubscription(
    orgId: string,
    input: CreateOrgSubscriptionInput
  ): Promise<OrgSubscriptionResponse> {
    const { plan, billingCycle, paymentMethodId } = input;

    // 既存サブスクリプションの確認
    // ACTIVE または PAST_DUE（支払い遅延中だが有効）の場合は新規作成を拒否
    const existingSub = await this.subscriptionRepo.findByOrganizationId(orgId);
    if (
      existingSub &&
      (existingSub.status === 'ACTIVE' || existingSub.status === 'PAST_DUE')
    ) {
      throw new ValidationError('すでにアクティブなサブスクリプションがあります');
    }

    // 支払い方法の確認
    const paymentMethod = await this.paymentMethodRepo.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.organizationId !== orgId) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    // 決済顧客IDの取得または作成
    const customerId = await this.ensureOrgPaymentCustomer(orgId);

    // メンバー数を取得
    const quantity = await this.getMemberCount(orgId);
    if (quantity < 1) {
      throw new ValidationError('組織にメンバーが存在しません');
    }

    // 決済ゲートウェイでサブスクリプションを作成
    const gatewayResult = await this.paymentGateway.createOrgSubscription({
      customerId,
      plan,
      billingCycle,
      paymentMethodId: paymentMethod.externalId,
      quantity,
    });

    // DBにサブスクリプションを作成/更新（externalIdを保存）
    const subscription = await this.subscriptionRepo.upsertForOrganization(orgId, {
      externalId: gatewayResult.id,
      plan,
      billingCycle,
      currentPeriodStart: gatewayResult.currentPeriodStart,
      currentPeriodEnd: gatewayResult.currentPeriodEnd,
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
    });

    // 組織のプランを更新
    await prisma.organization.update({
      where: { id: orgId },
      data: { plan },
    });

    logger.info({
      orgId,
      subscriptionId: subscription.id,
      externalId: gatewayResult.id,
      plan,
      billingCycle,
      quantity,
    }, 'Organization subscription created');

    return this.toResponse(subscription, quantity);
  }

  /**
   * サブスクリプションを更新（請求サイクルの変更）
   */
  async updateSubscription(
    orgId: string,
    input: UpdateOrgSubscriptionInput
  ): Promise<OrgSubscriptionResponse> {
    const subscription = await this.subscriptionRepo.findByOrganizationId(orgId);
    if (!subscription) {
      throw new NotFoundError('Subscription', orgId);
    }

    if (!subscription.externalId) {
      throw new ValidationError('外部サブスクリプションが見つかりません');
    }

    const quantity = await this.getMemberCount(orgId);

    // 決済ゲートウェイでサブスクリプションを更新
    const gatewayResult = await this.paymentGateway.updateOrgSubscription(
      subscription.externalId,
      {
        billingCycle: input.billingCycle,
        quantity,
      }
    );

    // DBを更新
    const updated = await this.subscriptionRepo.update(subscription.id, {
      billingCycle: input.billingCycle,
      currentPeriodStart: gatewayResult.currentPeriodStart,
      currentPeriodEnd: gatewayResult.currentPeriodEnd,
    });

    logger.info({
      orgId,
      subscriptionId: subscription.id,
      externalId: subscription.externalId,
      billingCycle: input.billingCycle,
    }, 'Organization subscription updated');

    return this.toResponse(updated, quantity);
  }

  /**
   * サブスクリプションをキャンセル（期間終了時にキャンセル予約）
   * 注: Organization.plan は TEAM のまま維持（status で制御）
   */
  async cancelSubscription(orgId: string): Promise<OrgSubscriptionResponse> {
    const subscription = await this.subscriptionRepo.findByOrganizationId(orgId);
    if (!subscription) {
      throw new NotFoundError('Subscription', orgId);
    }

    if (subscription.cancelAtPeriodEnd) {
      throw new ValidationError('すでにキャンセル予約されています');
    }

    // 決済ゲートウェイでキャンセル予約（externalIdがある場合のみ）
    if (subscription.externalId) {
      await this.paymentGateway.cancelSubscription(subscription.externalId, true);
    }

    // DBでキャンセル予約を設定
    const updated = await this.subscriptionRepo.update(subscription.id, {
      cancelAtPeriodEnd: true,
    });

    const quantity = await this.getMemberCount(orgId);

    logger.info({
      orgId,
      subscriptionId: subscription.id,
      externalId: subscription.externalId,
      currentPeriodEnd: subscription.currentPeriodEnd,
    }, 'Organization subscription cancellation scheduled');

    return this.toResponse(updated, quantity);
  }

  /**
   * キャンセル予約を解除（サブスクリプション継続）
   */
  async reactivateSubscription(orgId: string): Promise<OrgSubscriptionResponse> {
    const subscription = await this.subscriptionRepo.findByOrganizationId(orgId);
    if (!subscription) {
      throw new NotFoundError('Subscription', orgId);
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new ValidationError('キャンセル予約されていません');
    }

    // 決済ゲートウェイでキャンセル予約を解除（externalIdがある場合のみ）
    if (subscription.externalId) {
      await this.paymentGateway.reactivateSubscription(subscription.externalId);
    }

    // DBでキャンセル予約を解除
    const updated = await this.subscriptionRepo.update(subscription.id, {
      cancelAtPeriodEnd: false,
    });

    const quantity = await this.getMemberCount(orgId);

    logger.info({
      orgId,
      subscriptionId: subscription.id,
      externalId: subscription.externalId,
    }, 'Organization subscription reactivated');

    return this.toResponse(updated, quantity);
  }

  /**
   * メンバー数をStripeと同期
   * サブスクリプションがない場合は何もしない
   */
  async syncMemberCount(orgId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findByOrganizationId(orgId);
    if (!subscription || !subscription.externalId) {
      // サブスクリプションがない場合は何もしない
      return;
    }

    const quantity = await this.getMemberCount(orgId);

    // Stripeのサブスクリプション数量を更新
    await this.paymentGateway.updateSubscriptionQuantity(
      subscription.externalId,
      quantity
    );

    logger.info({
      orgId,
      subscriptionId: subscription.id,
      externalId: subscription.externalId,
      quantity,
    }, 'Organization member count synced');
  }

  /**
   * プラン変更時の料金計算
   */
  async calculatePlanChange(
    orgId: string,
    plan: OrgPlan,
    billingCycle: BillingCycle
  ): Promise<OrgPlanChangeCalculation> {
    const pricing = ORG_PLAN_PRICING[plan];
    const pricePerUser =
      billingCycle === 'YEARLY' ? pricing.yearlyPrice : pricing.monthlyPrice;
    const quantity = await this.getMemberCount(orgId);
    const totalPrice = pricePerUser * quantity;

    return {
      plan,
      billingCycle,
      pricePerUser,
      quantity,
      totalPrice,
      currency: 'jpy',
      effectiveDate: new Date(),
    };
  }

  /**
   * 組織の決済顧客IDを取得または作成
   */
  private async ensureOrgPaymentCustomer(orgId: string): Promise<string> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new NotFoundError('Organization', orgId);
    }

    if (org.paymentCustomerId) {
      return org.paymentCustomerId;
    }

    // billingEmail を優先、なければ OWNER メンバーの email をフォールバック
    let email = org.billingEmail;
    if (!email) {
      const ownerMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId: orgId,
          role: 'OWNER',
        },
        include: {
          user: true,
        },
      });
      if (ownerMember?.user?.email) {
        email = ownerMember.user.email;
      }
    }

    if (!email) {
      throw new ValidationError('組織の請求先メールアドレスが設定されていません');
    }

    // 決済顧客を作成
    const customer = await this.paymentGateway.createCustomer(email, {
      organizationId: orgId,
    });

    // 組織に決済顧客IDを保存
    await prisma.organization.update({
      where: { id: orgId },
      data: { paymentCustomerId: customer.id },
    });

    return customer.id;
  }

  /**
   * 組織のメンバー数を取得
   */
  private async getMemberCount(orgId: string): Promise<number> {
    return prisma.organizationMember.count({
      where: { organizationId: orgId },
    });
  }

  /**
   * Subscriptionエンティティをレスポンス形式に変換
   */
  private toResponse(
    subscription: Subscription,
    quantity: number
  ): OrgSubscriptionResponse {
    return {
      id: subscription.id,
      plan: subscription.plan as OrgPlan,
      billingCycle: subscription.billingCycle as BillingCycle,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      quantity,
    };
  }
}
