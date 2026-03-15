import { KEY_PREFIX } from './client.js';
import {
  setCache,
  getCache,
  invalidateCacheByPattern,
  invalidateCache,
  generateParamsKey,
} from './helpers.js';

// ============================================
// システム管理者（AdminUser）一覧キャッシュ
// ============================================

export async function setSystemAdminsCache<T>(
  params: Record<string, unknown>,
  data: T,
  ttlSeconds: number = 60
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.SYSTEM_ADMINS, params),
    data,
    ttlSeconds,
    'システム管理者一覧キャッシュの保存に失敗'
  );
}

export async function getSystemAdminsCache<T>(params: Record<string, unknown>): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.SYSTEM_ADMINS, params),
    'システム管理者一覧キャッシュの取得に失敗'
  );
}

export async function invalidateSystemAdminsCache(): Promise<boolean> {
  return invalidateCacheByPattern(
    `${KEY_PREFIX.SYSTEM_ADMINS}*`,
    'システム管理者一覧キャッシュの無効化に失敗'
  );
}

// ============================================
// システム管理者（AdminUser）詳細キャッシュ
// ============================================

export async function getSystemAdminDetailCache<T>(adminUserId: string): Promise<T | null> {
  return getCache<T>(
    `${KEY_PREFIX.SYSTEM_ADMIN_DETAIL}${adminUserId}`,
    'システム管理者詳細キャッシュの取得に失敗'
  );
}

export async function setSystemAdminDetailCache<T>(
  adminUserId: string,
  data: T,
  ttlSeconds: number = 30
): Promise<boolean> {
  return setCache(
    `${KEY_PREFIX.SYSTEM_ADMIN_DETAIL}${adminUserId}`,
    data,
    ttlSeconds,
    'システム管理者詳細キャッシュの保存に失敗'
  );
}

export async function invalidateSystemAdminDetailCache(adminUserId: string): Promise<boolean> {
  return invalidateCache(
    `${KEY_PREFIX.SYSTEM_ADMIN_DETAIL}${adminUserId}`,
    'システム管理者詳細キャッシュの無効化に失敗'
  );
}
