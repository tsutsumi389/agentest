/**
 * Prismaクライアントのre-export
 */
export { prisma } from '@agentest/db';

// 型のre-export
export type { PaymentEvent, SubscriptionStatus } from '@agentest/db';

/**
 * Prisma接続をクローズ
 */
export async function closePrisma(): Promise<void> {
  const { prisma } = await import('@agentest/db');
  await prisma.$disconnect();
  console.log('[Jobs] Prisma接続をクローズしました');
}
