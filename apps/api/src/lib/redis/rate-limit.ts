import { invalidateCacheByPattern } from './helpers.js';

/**
 * レート制限関連のRedisキーをすべて削除する
 * テストのクリーンアップ用途
 */
export async function clearRateLimitKeys(): Promise<boolean> {
  // rate-limiter.tsのRATE_LIMIT_PREFIXと一致させる
  return invalidateCacheByPattern('ratelimit:*', 'レート制限キーのクリアに失敗');
}
// NOTE: 循環依存を避けるためプレフィックス文字列は直接記述
