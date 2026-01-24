import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '@agentest/shared';
import { AdminDashboardService } from '../../services/admin/admin-dashboard.service.js';

/**
 * 管理者ダッシュボードコントローラー
 */
export class AdminDashboardController {
  private dashboardService = new AdminDashboardService();

  /**
   * ダッシュボード統計を取得
   * GET /admin/dashboard
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminUser) {
        throw new AuthenticationError('認証が必要です');
      }

      const stats = await this.dashboardService.getDashboard();

      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
