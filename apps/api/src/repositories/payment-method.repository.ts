/**
 * 支払い方法リポジトリ
 */

import {
  prisma,
  type PaymentMethod,
  type PaymentMethodType,
  type Prisma,
} from '@agentest/db';

/**
 * 支払い方法作成パラメータ
 */
export interface CreatePaymentMethodParams {
  userId?: string;
  organizationId?: string;
  type?: PaymentMethodType;
  externalId: string;
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

/**
 * 支払い方法更新パラメータ
 */
export interface UpdatePaymentMethodParams {
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

/**
 * 支払い方法リポジトリ
 */
export class PaymentMethodRepository {
  /**
   * ユーザーの支払い方法一覧を取得
   */
  async findByUserId(userId: string): Promise<PaymentMethod[]> {
    return prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * 組織の支払い方法一覧を取得
   */
  async findByOrganizationId(organizationId: string): Promise<PaymentMethod[]> {
    return prisma.paymentMethod.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * IDで支払い方法を取得
   */
  async findById(id: string): Promise<PaymentMethod | null> {
    return prisma.paymentMethod.findUnique({
      where: { id },
    });
  }

  /**
   * 外部IDで支払い方法を取得
   */
  async findByExternalId(externalId: string): Promise<PaymentMethod | null> {
    return prisma.paymentMethod.findFirst({
      where: { externalId },
    });
  }

  /**
   * ユーザーのデフォルト支払い方法を取得
   */
  async findDefaultByUserId(userId: string): Promise<PaymentMethod | null> {
    return prisma.paymentMethod.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });
  }

  /**
   * 組織のデフォルト支払い方法を取得
   */
  async findDefaultByOrganizationId(
    organizationId: string
  ): Promise<PaymentMethod | null> {
    return prisma.paymentMethod.findFirst({
      where: {
        organizationId,
        isDefault: true,
      },
    });
  }

  /**
   * 支払い方法を作成
   */
  async create(params: CreatePaymentMethodParams): Promise<PaymentMethod> {
    return prisma.paymentMethod.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        type: params.type ?? 'CARD',
        externalId: params.externalId,
        brand: params.brand,
        last4: params.last4,
        expiryMonth: params.expiryMonth,
        expiryYear: params.expiryYear,
        isDefault: params.isDefault ?? false,
      },
    });
  }

  /**
   * 支払い方法を更新
   */
  async update(
    id: string,
    params: UpdatePaymentMethodParams
  ): Promise<PaymentMethod> {
    const data: Prisma.PaymentMethodUpdateInput = {};

    if (params.brand !== undefined) data.brand = params.brand;
    if (params.last4 !== undefined) data.last4 = params.last4;
    if (params.expiryMonth !== undefined) data.expiryMonth = params.expiryMonth;
    if (params.expiryYear !== undefined) data.expiryYear = params.expiryYear;
    if (params.isDefault !== undefined) data.isDefault = params.isDefault;

    return prisma.paymentMethod.update({
      where: { id },
      data,
    });
  }

  /**
   * 支払い方法を削除
   */
  async delete(id: string): Promise<void> {
    await prisma.paymentMethod.delete({
      where: { id },
    });
  }

  /**
   * ユーザーのデフォルト支払い方法を設定
   * 既存のデフォルトを解除し、指定された支払い方法をデフォルトに設定
   */
  async setDefaultForUser(userId: string, paymentMethodId: string): Promise<void> {
    await prisma.$transaction([
      // 既存のデフォルトを解除
      prisma.paymentMethod.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: { isDefault: false },
      }),
      // 新しいデフォルトを設定
      prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      }),
    ]);
  }

  /**
   * 組織のデフォルト支払い方法を設定
   */
  async setDefaultForOrganization(
    organizationId: string,
    paymentMethodId: string
  ): Promise<void> {
    await prisma.$transaction([
      // 既存のデフォルトを解除
      prisma.paymentMethod.updateMany({
        where: {
          organizationId,
          isDefault: true,
        },
        data: { isDefault: false },
      }),
      // 新しいデフォルトを設定
      prisma.paymentMethod.update({
        where: { id: paymentMethodId },
        data: { isDefault: true },
      }),
    ]);
  }

  /**
   * ユーザーの支払い方法数を取得
   */
  async countByUserId(userId: string): Promise<number> {
    return prisma.paymentMethod.count({
      where: { userId },
    });
  }

  /**
   * 組織の支払い方法数を取得
   */
  async countByOrganizationId(organizationId: string): Promise<number> {
    return prisma.paymentMethod.count({
      where: { organizationId },
    });
  }
}
