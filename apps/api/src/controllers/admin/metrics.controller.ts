import type { Request, Response, NextFunction } from 'express';
import {
  AuthenticationError,
  activeUserMetricsQuerySchema,
  planDistributionQuerySchema,
} from '@agentest/shared';
import { AdminMetricsService } from '../../services/admin/admin-metrics.service.js';

/**
 * 管理者メトリクスコントローラー
 */
export class AdminMetricsController {
  private metricsService = new AdminMetricsService();

  /**
   * アクティブユーザーメトリクスを取得
   * GET /admin/metrics/active-users
   */
  getActiveUserMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAdminAuth()ミドルウェアで認証済みだが、TypeScript型安全性のためチェック
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // クエリパラメータのバリデーション
      const validatedQuery = activeUserMetricsQuerySchema.parse(req.query);

      const metrics = await this.metricsService.getActiveUserMetrics(validatedQuery);

      res.json(metrics);
    } catch (error) {
      next(error);
    }
  };

  /**
   * プラン分布メトリクスを取得
   * GET /admin/metrics/plan-distribution
   */
  getPlanDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // requireAdminAuth()ミドルウェアで認証済みだが、TypeScript型安全性のためチェック
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      // クエリパラメータのバリデーション
      const validatedQuery = planDistributionQuerySchema.parse(req.query);

      const metrics = await this.metricsService.getPlanDistribution(validatedQuery);

      res.json(metrics);
    } catch (error) {
      next(error);
    }
  };
}
