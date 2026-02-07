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
      // express.raw()で受け取ったBufferまたは文字列をそのまま使用
      // JSON.stringifyでの再構築は署名検証が必ず失敗するため不可
      if (!Buffer.isBuffer(req.body) && typeof req.body !== 'string') {
        res.status(400).json({
          error: 'Invalid request body: raw body is required for webhook signature verification',
        });
        return;
      }
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : req.body;

      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }

      // 署名検証とイベントパース
      const gateway = getPaymentGateway();
      const event = gateway.verifyAndParseWebhookEvent(rawBody, signature);

      // イベント処理（冪等性チェック付き）
      const result = await this.webhookService.handleEvent(event);

      res.json({ received: true, duplicate: result.duplicate });
    } catch (error) {
      logger.error({
        err: error instanceof Error ? error : undefined,
      }, 'Webhook processing failed');
      next(error);
    }
  };
}
