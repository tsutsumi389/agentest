import { Router } from 'express';
import { prisma } from '@agentest/db';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

const router: Router = Router();

/**
 * データベース接続チェック
 */
async function checkDatabase(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    return { status: 'unhealthy', error: (error as Error).message };
  }
}

/**
 * Redis接続チェック
 */
async function checkRedis(): Promise<{ status: 'healthy' | 'unhealthy' | 'not_configured'; latency?: number; error?: string }> {
  if (!env.REDIS_URL) {
    return { status: 'not_configured' };
  }

  const start = Date.now();
  const redis = new Redis(env.REDIS_URL);

  try {
    await redis.ping();
    await redis.quit();
    return { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    try {
      await redis.quit();
    } catch {
      // 無視
    }
    return { status: 'unhealthy', error: (error as Error).message };
  }
}

/**
 * ヘルスチェックエンドポイント
 * GET /health
 */
router.get('/health', async (_req, res) => {
  const [database, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const isHealthy = database.status === 'healthy' &&
    (redis.status === 'healthy' || redis.status === 'not_configured');

  const health = {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.0.1',
    checks: {
      database,
      redis,
    },
  };

  res.status(isHealthy ? 200 : 503).json(health);
});

/**
 * 軽量ヘルスチェック（ロードバランサー用）
 * GET /health/live
 */
router.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * 準備状況チェック（Kubernetes readiness probe用）
 * GET /health/ready
 */
router.get('/health/ready', async (_req, res) => {
  const database = await checkDatabase();

  if (database.status === 'healthy') {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not_ready', reason: 'database' });
  }
});

export default router;
