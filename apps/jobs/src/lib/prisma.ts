/**
 * Prismaクライアントのre-export
 */
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'prisma' });

export { prisma } from '@agentest/db';

// 型のre-export
export type { PaymentEvent, SubscriptionStatus } from '@agentest/db';

/**
 * Prisma接続をクローズ
 */
export async function closePrisma(): Promise<void> {
  const { prisma } = await import('@agentest/db');
  await prisma.$disconnect();
  logger.info('Prisma接続をクローズしました');
}
