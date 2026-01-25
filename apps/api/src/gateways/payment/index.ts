/**
 * 決済ゲートウェイモジュール
 */

export type { IPaymentGateway } from './payment-gateway.interface.js';
export * from './types.js';
export { MockGateway } from './mock.gateway.js';
export { StripeGateway } from './stripe.gateway.js';

import type { IPaymentGateway } from './payment-gateway.interface.js';
import { MockGateway } from './mock.gateway.js';
import { StripeGateway } from './stripe.gateway.js';

/**
 * 決済ゲートウェイのシングルトンインスタンス
 */
let paymentGatewayInstance: IPaymentGateway | null = null;

/**
 * 決済ゲートウェイを取得
 * 環境変数 PAYMENT_GATEWAY に基づいて適切な実装を返す
 *
 * - 'stripe': StripeGateway（本番用、要Stripeアカウント）
 * - 'mock': MockGateway（開発・テスト用）
 * - デフォルト: MockGateway
 */
export function getPaymentGateway(): IPaymentGateway {
  if (paymentGatewayInstance) {
    return paymentGatewayInstance;
  }

  paymentGatewayInstance = createPaymentGateway();
  return paymentGatewayInstance;
}

/**
 * 決済ゲートウェイを作成
 */
export function createPaymentGateway(): IPaymentGateway {
  const gatewayType = process.env.PAYMENT_GATEWAY || 'mock';

  switch (gatewayType) {
    case 'stripe':
      return new StripeGateway();
    case 'mock':
    default:
      return new MockGateway();
  }
}

/**
 * シングルトンインスタンスをリセット（テスト用）
 */
export function resetPaymentGateway(): void {
  paymentGatewayInstance = null;
}

/**
 * シングルトンインスタンスを差し替え（テスト用）
 */
export function setPaymentGateway(gateway: IPaymentGateway): void {
  paymentGatewayInstance = gateway;
}
