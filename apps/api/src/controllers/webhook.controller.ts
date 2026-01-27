/**
 * Webhookコントローラー
 * Stripeからのwebhookリクエストを受信・処理
 */

import type { Request, Response, NextFunction } from 'express';
import { getPaymentGateway } from '../gateways/payment/index.js';
import { WebhookService } from '../services/webhook.service.js';
import { logger } from '../utils/logger.js';

/**
 * Webhookコントローラー
 */
export class WebhookController {
  private webhookService = new WebhookService();

  /**
   * Stripe Webhookイベントを処理
   * POST /webhooks/stripe
   */
  handleStripeWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // express.raw()で受け取ったBufferを文字列に変換
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body);

      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }

      // 署名検証とイベントパース
      const gateway = getPaymentGateway();
      const event = gateway.verifyAndParseWebhookEvent(rawBody, signature);

      // イベント処理
      await this.webhookService.handleEvent(event);

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook processing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  };
}
