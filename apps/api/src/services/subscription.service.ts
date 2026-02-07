/**
 * サブスクリプションサービス
 * 個人ユーザーのサブスクリプション管理を担当
 */

import { prisma, type Subscription } from '@agentest/db';
import {
  NotFoundError,
  ValidationError,
  type BillingCycle,
  type PersonalPlan,
  PERSONAL_PLAN_PRICING,
} from '@agentest/shared';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { PaymentMethodRepository } from '../repositories/payment-method.repository.js';
import { getPaymentGateway } from '../gateways/payment/index.js';
import type { IPaymentGateway } from '../gateways/payment/payment-gateway.interface.js';
import { logger } from '../utils/logger.js';

/**
 * サブスクリプション作成パラメータ
 */
export interface CreateSubscriptionInput {
  plan: 'PRO';
  billingCycle: BillingCycle;
  paymentMethodId: string;
}

/**
 * 料金計算結果
 */
export interface PlanChangeCalculation {
  plan: PersonalPlan;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  prorationAmount?: number;
  effectiveDate: Date;
}

/**
 * サブスクリプションレスポンス
 */
export interface SubscriptionResponse {
  id: string;
  plan: PersonalPlan;
  billingCycle: BillingCycle;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

/**
 * サブスクリプションサービス
 */
export class SubscriptionService {
  private subscriptionRepo = new SubscriptionRepository();
  private paymentMethodRepo = new PaymentMethodRepository();
  private paymentGateway: IPaymentGateway;

  constructor() {
    this.paymentGateway = getPaymentGateway();
  }

  /**
   * ユーザーのサブスクリプションを取得
   */
  async getSubscription(userId: string): Promise<SubscriptionResponse | null> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription) {
      return null;
    }

    return this.toResponse(subscription);
  }

  /**
   * サブスクリプションを作成（FREE → PROへのアップグレード）
   */
  async createSubscription(
    userId: string,
    input: CreateSubscriptionInput
  ): Promise<SubscriptionResponse> {
    const { plan, billingCycle, paymentMethodId } = input;

    // 既存サブスクリプションの確認
    const existingSub = await this.subscriptionRepo.findByUserId(userId);
    if (existingSub && existingSub.plan !== 'FREE') {
      throw new ValidationError('すでにPROプランに加入しています');
    }

    // 支払い方法の確認
    const paymentMethod = await this.paymentMethodRepo.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // 決済顧客IDの取得または作成
    let customerId = user.paymentCustomerId;
    if (!customerId) {
      const customer = await this.paymentGateway.createCustomer(user.email, {
        userId: user.id,
      });
      customerId = customer.id;

      // ユーザーに決済顧客IDを保存
      await prisma.user.update({
        where: { id: userId },
        data: { paymentCustomerId: customerId },
      });
    }

    // 決済ゲートウェイでサブスクリプションを作成
    const gatewayResult = await this.paymentGateway.createSubscription({
      customerId,
      plan,
      billingCycle,
      paymentMethodId: paymentMethod.externalId,
    });

    // DBにサブスクリプションを作成/更新（externalIdを保存）
    const subscription = await this.subscriptionRepo.upsertForUser(userId, {
      externalId: gatewayResult.id,
      plan,
      billingCycle,
      currentPeriodStart: gatewayResult.currentPeriodStart,
      currentPeriodEnd: gatewayResult.currentPeriodEnd,
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
    });

    // ユーザーのプランを更新
    await prisma.user.update({
      where: { id: userId },
      data: { plan },
    });

    logger.info({
      userId,
      subscriptionId: subscription.id,
      externalId: gatewayResult.id,
      plan,
      billingCycle,
    }, 'Subscription created');

    return this.toResponse(subscription);
  }

  /**
   * サブスクリプションをキャンセル（PRO → FREEへのダウングレード予約）
   */
  async cancelSubscription(userId: string): Promise<SubscriptionResponse> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription) {
      throw new NotFoundError('Subscription', userId);
    }

    if (subscription.plan === 'FREE') {
      throw new ValidationError('FREEプランはキャンセルできません');
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

    logger.info({
      userId,
      subscriptionId: subscription.id,
      externalId: subscription.externalId,
      currentPeriodEnd: subscription.currentPeriodEnd,
    }, 'Subscription cancellation scheduled');

    return this.toResponse(updated);
  }

  /**
   * ダウングレード予約をキャンセル（サブスクリプション継続）
   */
  async reactivateSubscription(userId: string): Promise<SubscriptionResponse> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription) {
      throw new NotFoundError('Subscription', userId);
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

    logger.info({
      userId,
      subscriptionId: subscription.id,
      externalId: subscription.externalId,
    }, 'Subscription reactivated');

    return this.toResponse(updated);
  }

  /**
   * プラン変更時の料金計算
   */
  async calculatePlanChange(
    userId: string,
    plan: PersonalPlan,
    billingCycle: BillingCycle
  ): Promise<PlanChangeCalculation> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    const pricing = PERSONAL_PLAN_PRICING[plan];
    const price =
      billingCycle === 'YEARLY' ? pricing.yearlyPrice : pricing.monthlyPrice;

    // 新規サブスクリプション（FREEからのアップグレード）
    if (!subscription || subscription.plan === 'FREE') {
      return {
        plan,
        billingCycle,
        price,
        currency: 'jpy',
        effectiveDate: new Date(),
      };
    }

    // 既存サブスクリプションがある場合は日割り計算
    // 実際の本番環境ではStripeのpreviewProrationを使用
    const currentPlan = subscription.plan as PersonalPlan;

    // ユーザー情報取得
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.paymentCustomerId || !subscription.externalId) {
      // 決済顧客またはexternalIdがない場合は単純な価格を返す
      return {
        plan,
        billingCycle,
        price,
        currency: 'jpy',
        effectiveDate: new Date(),
      };
    }

    try {
      const prorationPreview = await this.paymentGateway.previewProration({
        customerId: user.paymentCustomerId,
        subscriptionId: subscription.externalId,
        currentPlan,
        newPlan: plan,
        billingCycle,
      });

      return {
        plan,
        billingCycle,
        price,
        currency: prorationPreview.currency,
        prorationAmount: prorationPreview.amountDue,
        effectiveDate: prorationPreview.effectiveDate,
      };
    } catch (error) {
      // 日割り計算に失敗した場合はログ出力して単純な価格を返す
      logger.warn({
        err: error instanceof Error ? error : undefined,
        userId,
        plan,
        billingCycle,
      }, 'Failed to calculate proration');
      return {
        plan,
        billingCycle,
        price,
        currency: 'jpy',
        effectiveDate: new Date(),
      };
    }
  }

  /**
   * Subscriptionエンティティをレスポンス形式に変換
   */
  private toResponse(subscription: Subscription): SubscriptionResponse {
    return {
      id: subscription.id,
      plan: subscription.plan as PersonalPlan,
      billingCycle: subscription.billingCycle as BillingCycle,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }
}
