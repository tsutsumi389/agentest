/**
 * 支払い方法サービス
 * 個人ユーザーの支払い方法管理を担当
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
 * 支払い方法サービス
 */
export class PaymentMethodService {
  private paymentMethodRepo = new PaymentMethodRepository();
  private paymentGateway: IPaymentGateway;

  constructor() {
    this.paymentGateway = getPaymentGateway();
  }

  /**
   * ユーザーの支払い方法一覧を取得
   */
  async getPaymentMethods(userId: string): Promise<PaymentMethodResponse[]> {
    const paymentMethods = await this.paymentMethodRepo.findByUserId(userId);
    return paymentMethods.map(this.toResponse);
  }

  /**
   * 支払い方法を追加
   * @param userId ユーザーID
   * @param token 決済サービスから取得したトークン（Stripe Payment Method ID等）
   */
  async addPaymentMethod(
    userId: string,
    token: string
  ): Promise<PaymentMethodResponse> {
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

    // 決済ゲートウェイに支払い方法を紐付け
    const gatewayResult = await this.paymentGateway.attachPaymentMethod(
      customerId,
      token
    );

    // 最初の支払い方法の場合はデフォルトに設定
    const existingCount = await this.paymentMethodRepo.countByUserId(userId);
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
      userId,
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
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    // 支払い方法の存在と所有者確認
    const paymentMethod = await this.paymentMethodRepo.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    // デフォルト支払い方法は削除不可（他に支払い方法がある場合）
    if (paymentMethod.isDefault) {
      const count = await this.paymentMethodRepo.countByUserId(userId);
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
    userId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodResponse> {
    // 支払い方法の存在と所有者確認
    const paymentMethod = await this.paymentMethodRepo.findById(paymentMethodId);
    if (!paymentMethod || paymentMethod.userId !== userId) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    // すでにデフォルトの場合は何もしない
    if (paymentMethod.isDefault) {
      return this.toResponse(paymentMethod);
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.paymentCustomerId) {
      throw new ValidationError('決済顧客情報がありません');
    }

    // 決済ゲートウェイでデフォルト設定
    await this.paymentGateway.setDefaultPaymentMethod(
      user.paymentCustomerId,
      paymentMethod.externalId
    );

    // DBでデフォルト設定
    await this.paymentMethodRepo.setDefaultForUser(userId, paymentMethodId);

    // 更新後のデータを取得して返す
    const updated = await this.paymentMethodRepo.findById(paymentMethodId);
    if (!updated) {
      throw new NotFoundError('PaymentMethod', paymentMethodId);
    }

    return this.toResponse(updated);
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
