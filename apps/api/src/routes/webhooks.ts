/**
 * Webhookルート
 * 認証不要、レート制限なし
 */

import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

const router: Router = Router();
const webhookController = new WebhookController();

// Stripe Webhook
router.post('/stripe', webhookController.handleStripeWebhook);

export default router;
