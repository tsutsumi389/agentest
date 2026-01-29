/**
 * バッチジョブ共通定数
 */

/** Webhookイベントの最大リトライ回数 */
export const MAX_RETRY_COUNT = 5;

/** バッチ処理のデフォルトサイズ */
export const DEFAULT_BATCH_SIZE = 100;

/** 処理済みPaymentEventの保持日数 */
export const PAYMENT_EVENT_RETENTION_DAYS = 90;

/** プロジェクト物理削除までの日数 */
export const PROJECT_CLEANUP_DAYS = 30;
