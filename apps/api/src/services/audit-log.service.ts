import type { AuditLog } from '@agentest/db';
import {
  AuditLogRepository,
  type AuditLogQueryOptions,
  type AuditLogCreateParams,
} from '../repositories/audit-log.repository.js';

// 型をre-export（外部から利用しやすくする）
export type { AuditLogQueryOptions, AuditLogCreateParams };

/**
 * 監査ログサービス
 *
 * 組織やユーザーの操作履歴を記録・取得する
 */
export class AuditLogService {
  /**
   * @param auditLogRepo - 監査ログリポジトリ（テスト時にモック可能）
   */
  constructor(
    private auditLogRepo: AuditLogRepository = new AuditLogRepository()
  ) {}

  /**
   * 監査ログを記録
   *
   * ログ記録の失敗はメイン処理に影響を与えないようエラーを握りつぶす
   *
   * @param params - 監査ログのパラメータ
   */
  async log(params: AuditLogCreateParams): Promise<void> {
    // バリデーション: actionは必須かつ空文字でない
    if (!params.action || params.action.trim() === '') {
      console.warn('監査ログ: actionが空のため記録をスキップ', params);
      return;
    }

    try {
      await this.auditLogRepo.create(params);
    } catch (error) {
      // ログ記録の失敗は警告としてログ出力し、呼び出し元に伝播させない
      console.error('監査ログの記録に失敗:', error);
    }
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

// デフォルトインスタンスをエクスポート（シンプルな利用ケース向け）
export const auditLogService = new AuditLogService();
