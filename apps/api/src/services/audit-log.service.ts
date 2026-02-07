import type { AuditLog } from '@agentest/db';
import { logger as baseLogger } from '../utils/logger.js';
import {
  AuditLogRepository,
  AUDIT_LOG_DEFAULT_LIMIT,
  AUDIT_LOG_MAX_LIMIT,
  AUDIT_LOG_EXPORT_MAX_LIMIT,
  type AuditLogQueryOptions,
  type AuditLogCreateParams,
  type AuditLogExportOptions,
} from '../repositories/audit-log.repository.js';

// 型と定数をre-export（外部から利用しやすくする）
export type { AuditLogQueryOptions, AuditLogCreateParams, AuditLogExportOptions };
export { AUDIT_LOG_DEFAULT_LIMIT, AUDIT_LOG_MAX_LIMIT, AUDIT_LOG_EXPORT_MAX_LIMIT };

const logger = baseLogger.child({ module: 'audit-log' });

/**
 * ユーザー情報付き監査ログ（エクスポート用）
 */
interface AuditLogWithUser extends AuditLog {
  user: {
    id: string;
    email: string;
    name: string;
  } | null;
}

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
      logger.warn({ data: params }, '監査ログ: actionが空のため記録をスキップ');
      return;
    }

    try {
      await this.auditLogRepo.create(params);
    } catch (error) {
      // ログ記録の失敗は警告としてログ出力し、呼び出し元に伝播させない
      logger.error({ err: error }, '監査ログの記録に失敗');
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

  /**
   * 組織の監査ログをエクスポート用に取得
   *
   * @param organizationId - 組織ID
   * @param options - エクスポートオプション（フィルタリング）
   */
  async getForExport(
    organizationId: string,
    options: AuditLogExportOptions = {}
  ): Promise<AuditLogWithUser[]> {
    // リポジトリはuser情報を含めて取得するため、型をキャスト
    return this.auditLogRepo.findForExport(organizationId, options) as Promise<AuditLogWithUser[]>;
  }

  /**
   * 監査ログをCSV形式に変換
   *
   * @param logs - 監査ログ配列
   */
  formatAsCSV(logs: AuditLogWithUser[]): string {
    // BOM付きUTF-8（Excel対応）
    const BOM = '\uFEFF';
    const headers = ['ID', '日時', 'カテゴリ', 'アクション', 'ユーザー', '対象タイプ', '対象ID', 'IPアドレス', '詳細'];

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // ダブルクォートを含む場合やカンマ・改行を含む場合はエスケープ
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((log) => {
      const userEmail = log.user?.email || 'システム';
      const details = log.details ? JSON.stringify(log.details) : '';

      return [
        log.id,
        log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
        log.category,
        log.action,
        userEmail,
        log.targetType || '',
        log.targetId || '',
        log.ipAddress || '',
        details,
      ].map(escapeCSV).join(',');
    });

    return BOM + headers.join(',') + '\n' + rows.join('\n');
  }

  /**
   * 監査ログをJSON形式に変換
   *
   * @param logs - 監査ログ配列
   */
  formatAsJSON(logs: AuditLogWithUser[]): string {
    const exportData = logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
      category: log.category,
      action: log.action,
      user: log.user ? {
        id: log.user.id,
        email: log.user.email,
        name: log.user.name,
      } : null,
      targetType: log.targetType,
      targetId: log.targetId,
      ipAddress: log.ipAddress,
      details: log.details,
    }));

    return JSON.stringify(exportData, null, 2);
  }
}

// デフォルトインスタンスをエクスポート（シンプルな利用ケース向け）
export const auditLogService = new AuditLogService();
