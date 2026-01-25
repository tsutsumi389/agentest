/**
 * サブスクリプションリポジトリ
 */

import {
  prisma,
  type BillingCycle,
  type Prisma,
  type Subscription,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '@agentest/db';

/**
 * サブスクリプション作成パラメータ
 */
export interface CreateSubscriptionParams {
  userId?: string;
  organizationId?: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  status?: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
}

/**
 * サブスクリプション更新パラメータ
 */
export interface UpdateSubscriptionParams {
  plan?: SubscriptionPlan;
  billingCycle?: BillingCycle;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

/**
 * サブスクリプションリポジトリ
 */
export class SubscriptionRepository {
  /**
   * ユーザーIDでサブスクリプションを取得
   */
  async findByUserId(userId: string): Promise<Subscription | null> {
    return prisma.subscription.findFirst({
      where: { userId },
    });
  }

  /**
   * 組織IDでサブスクリプションを取得
   */
  async findByOrganizationId(
    organizationId: string
  ): Promise<Subscription | null> {
    return prisma.subscription.findFirst({
      where: { organizationId },
    });
  }

  /**
   * IDでサブスクリプションを取得
   */
  async findById(id: string): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
      where: { id },
    });
  }

  /**
   * サブスクリプションを作成
   */
  async create(params: CreateSubscriptionParams): Promise<Subscription> {
    return prisma.subscription.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        plan: params.plan,
        billingCycle: params.billingCycle,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        status: params.status ?? 'ACTIVE',
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
      },
    });
  }

  /**
   * サブスクリプションを更新
   */
  async update(
    id: string,
    params: UpdateSubscriptionParams
  ): Promise<Subscription> {
    const data: Prisma.SubscriptionUpdateInput = {};

    if (params.plan !== undefined) data.plan = params.plan;
    if (params.billingCycle !== undefined) data.billingCycle = params.billingCycle;
    if (params.status !== undefined) data.status = params.status;
    if (params.currentPeriodStart !== undefined)
      data.currentPeriodStart = params.currentPeriodStart;
    if (params.currentPeriodEnd !== undefined)
      data.currentPeriodEnd = params.currentPeriodEnd;
    if (params.cancelAtPeriodEnd !== undefined)
      data.cancelAtPeriodEnd = params.cancelAtPeriodEnd;

    return prisma.subscription.update({
      where: { id },
      data,
    });
  }

  /**
   * サブスクリプションを削除
   */
  async delete(id: string): Promise<void> {
    await prisma.subscription.delete({
      where: { id },
    });
  }

  /**
   * ユーザーのサブスクリプションをアップサート
   */
  async upsertForUser(
    userId: string,
    params: Omit<CreateSubscriptionParams, 'userId' | 'organizationId'>
  ): Promise<Subscription> {
    return prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: params.plan,
        billingCycle: params.billingCycle,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        status: params.status ?? 'ACTIVE',
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
      },
      update: {
        plan: params.plan,
        billingCycle: params.billingCycle,
        currentPeriodStart: params.currentPeriodStart,
        currentPeriodEnd: params.currentPeriodEnd,
        status: params.status ?? 'ACTIVE',
        cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
      },
    });
  }

  /**
   * 期間終了時にキャンセル予定のサブスクリプションを取得
   */
  async findCancelAtPeriodEnd(): Promise<Subscription[]> {
    return prisma.subscription.findMany({
      where: {
        cancelAtPeriodEnd: true,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * 期間終了日が過ぎたサブスクリプションを取得
   */
  async findExpired(beforeDate: Date): Promise<Subscription[]> {
    return prisma.subscription.findMany({
      where: {
        currentPeriodEnd: {
          lt: beforeDate,
        },
        status: 'ACTIVE',
      },
    });
  }
}
