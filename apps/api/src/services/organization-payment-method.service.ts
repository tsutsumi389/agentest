/**
 * 組織向け支払い方法サービス
 * 組織の支払い方法管理を担当
 */

import { prisma, type PaymentMethod } from '@agentest/db';
import { NotFoundError, ValidationError } from '@agentest/shared';
import { PaymentMethodRepository } from '../repositories/payment-method.repository.js';
import { getPaymentGateway } from '../gateways/payment/index.js';
import type { IPaymentGateway } from '../gateways/payment/payment-gateway.interface.js';

/**
 * 支払い方法レスポンス
 */
export interface PaymentMethodResponse {
  id: string;
  brand: string | null;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: Date;
}

/**
 * 組織向け支払い方法サービス
 */
export class OrganizationPaymentMethodService {
  private paymentMethodRepo = new PaymentMethodRepository();
  private paymentGateway: IPaymentGateway;

  constructor() {
    this.paymentGateway = getPaymentGateway();
  }

  /**
   * SetupIntentを作成（Stripe Elements用）
   * フロントエンドがカード情報を収集するためのclient_secretを返す
   */
  async createSetupIntent(orgId: string): Promise<{ clientSecret: string }> {
    const customerId = await this.ensureOrgPaymentCustomer(orgId);

    const setupIntent =
      await this.paymentGateway.createSetupIntent(customerId);
    return { clientSecret: setupIntent.clientSecret };
  }

  /**
   * 組織の支払い方法一覧を取得
   */
  async getPaymentMethods(orgId: string): Promise<PaymentMethodResponse[]> {
    const paymentMethods =
      await this.paymentMethodRepo.findByOrganizationId(orgId);
    return paymentMethods.map(this.toResponse);
  }

  /**
   * 支払い方法を追加
   * @param orgId 組織ID
   * @param token 決済サービスから取得したトークン（Stripe Payment Method ID等）
   */
  async addPaymentMethod(
    orgId: string,
    token: string
  ): Promise<PaymentMethodResponse> {
    const customerId = await this.ensureOrgPaymentCustomer(orgId);

    // 決済ゲートウェイに支払い方法を紐付け
    const gatewayResult = await this.paymentGateway.attachPaymentMethod(
      customerId,
      token
    );

    // 最初の支払い方法の場合はデフォルトに設定
    const existingCount =
      await this.paymentMethodRepo.countByOrganizationId(orgId);
    const isDefault = existingCount === 0;

    // 決済ゲートウェイでもデフォルト設定
    if (isDefault) {
      await this.paymentGateway.setDefaultPaymentMethod(
        customerId,
        gatewayResult.id
      );
    }

    // DBに保存
    const paymentMethod = await this.paymentMethodRepo.create({
      organizationId: orgId,
      externalId: gatewayResult.id,
      brand: gatewayResult.brand,
      last4: gatewayResult.last4,
      expiryMonth: gatewayResult.expiryMonth,
      expiryYear: gatewayResult.expiryYear,
      isDefault,
    });

    return this.toResponse(paymentMethod);
  }

  /**
   * 支払い方法を削除
   */
  async deletePaymentMethod(
    orgId: string,
    paymentMethodId: string
  ): Promise<void> {
    // 支払い方法の存在と所有者確認
    const paymentMethod = await this.paymentMethodRepo.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.organizationId !== orgId) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    // デフォルト支払い方法は削除不可（他に支払い方法がある場合）
    if (paymentMethod.isDefault) {
      const count = await this.paymentMethodRepo.countByOrganizationId(orgId);
      if (count > 1) {
        throw new ValidationError(
          'デフォルトの支払い方法は削除できません。先に他の支払い方法をデフォルトに設定してください。'
        );
      }
    }

    // 決済ゲートウェイから削除
    await this.paymentGateway.detachPaymentMethod(paymentMethod.externalId);

    // DBから削除
    await this.paymentMethodRepo.delete(paymentMethodId);
  }

  /**
   * デフォルト支払い方法を設定
   */
  async setDefaultPaymentMethod(
    orgId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodResponse> {
    // 支払い方法の存在と所有者確認
    const paymentMethod = await this.paymentMethodRepo.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.organizationId !== orgId) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    // すでにデフォルトの場合は何もしない
    if (paymentMethod.isDefault) {
      return this.toResponse(paymentMethod);
    }

    // 組織情報取得
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org?.paymentCustomerId) {
      throw new ValidationError('決済顧客情報がありません');
    }

    // 決済ゲートウェイでデフォルト設定
    await this.paymentGateway.setDefaultPaymentMethod(
      org.paymentCustomerId,
      paymentMethod.externalId
    );

    // DBでデフォルト設定
    await this.paymentMethodRepo.setDefaultForOrganization(orgId, paymentMethodId);

    // 更新後のデータを取得して返す
    const updated = await this.paymentMethodRepo.findById(paymentMethodId);
    if (!updated) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    return this.toResponse(updated);
  }

  /**
   * 組織の決済顧客IDを取得し、未登録の場合は作成してDBに保存する
   */
  private async ensureOrgPaymentCustomer(orgId: string): Promise<string> {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
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

    const customer = await this.paymentGateway.createCustomer(email, {
      organizationId: orgId,
    });

    await prisma.organization.update({
      where: { id: orgId },
      data: { paymentCustomerId: customer.id },
    });

    return customer.id;
  }

  /**
   * PaymentMethodエンティティをレスポンス形式に変換
   */
  private toResponse(paymentMethod: PaymentMethod): PaymentMethodResponse {
    return {
      id: paymentMethod.id,
      brand: paymentMethod.brand,
      last4: paymentMethod.last4,
      expiryMonth: paymentMethod.expiryMonth,
      expiryYear: paymentMethod.expiryYear,
      isDefault: paymentMethod.isDefault,
      createdAt: paymentMethod.createdAt,
    };
  }
}
