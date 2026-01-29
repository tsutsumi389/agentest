/**
 * Stripeクライアント初期化
 */
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

/**
 * Stripeクライアントを取得
 * STRIPE_SECRET_KEYが設定されていない場合はnullを返す
 */
export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.warn('[Jobs] STRIPE_SECRET_KEYが設定されていません');
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
    console.log('[Jobs] Stripeクライアントを初期化しました');
  }

  return stripeClient;
}
