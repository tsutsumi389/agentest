import type { AuditLogCategory, AuditLog } from '@agentest/db';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';

/**
 * 監査ログのクエリオプション
 */
export interface AuditLogQueryOptions {
  page?: number;
  limit?: number;
  category?: AuditLogCategory;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 監査ログの記録パラメータ
 */
export interface AuditLogParams {
  userId?: string;
  organizationId?: string;
  category: AuditLogCategory;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 監査ログサービス
 *
 * 組織やユーザーの操作履歴を記録・取得する
 */
export class AuditLogService {
  private auditLogRepo = new AuditLogRepository();

  /**
   * 監査ログを記録
   *
   * @param params - 監査ログのパラメータ
   */
  async log(params: AuditLogParams): Promise<void> {
    await this.auditLogRepo.create(params);
  }

  /**
   * 組織の監査ログを取得
   *
   * @param organizationId - 組織ID
   * @param options - クエリオプション（ページネーション、フィルタリング）
   */
  async getByOrganization(
    organizationId: string,
    options: AuditLogQueryOptions = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    return this.auditLogRepo.findByOrganization(organizationId, options);
  }

  /**
   * ユーザーの監査ログを取得（個人の操作履歴）
   *
   * @param userId - ユーザーID
   * @param options - クエリオプション（ページネーション、フィルタリング）
   */
  async getByUser(
    userId: string,
    options: AuditLogQueryOptions = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    return this.auditLogRepo.findByUser(userId, options);
  }
}

// シングルトンインスタンスをエクスポート（他サービスから容易に利用できるように）
export const auditLogService = new AuditLogService();
