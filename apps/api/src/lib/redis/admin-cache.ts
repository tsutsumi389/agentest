import { KEY_PREFIX } from './client.js';
import { setCache, getCache, invalidateCache, invalidateCacheByPattern, generateParamsKey } from './helpers.js';

// ============================================
// 管理者ダッシュボードキャッシュ
// ============================================

export async function setAdminDashboardCache<T>(
  stats: T,
  ttlSeconds: number = 300
): Promise<boolean> {
  return setCache(KEY_PREFIX.ADMIN_DASHBOARD, stats, ttlSeconds, '管理者ダッシュボードキャッシュの保存に失敗');
}

export async function getAdminDashboardCache<T>(): Promise<T | null> {
  return getCache<T>(KEY_PREFIX.ADMIN_DASHBOARD, '管理者ダッシュボードキャッシュの取得に失敗');
}

export async function invalidateAdminDashboardCache(): Promise<boolean> {
  return invalidateCache(KEY_PREFIX.ADMIN_DASHBOARD, '管理者ダッシュボードキャッシュの無効化に失敗');
}

// ============================================
// 管理者ユーザー一覧キャッシュ
// ============================================

export async function setAdminUsersCache<T>(
  params: Record<string, unknown>,
  data: T,
  ttlSeconds: number = 60
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.ADMIN_USERS, params),
    data, ttlSeconds, '管理者ユーザー一覧キャッシュの保存に失敗'
  );
}

export async function getAdminUsersCache<T>(
  params: Record<string, unknown>
): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.ADMIN_USERS, params),
    '管理者ユーザー一覧キャッシュの取得に失敗'
  );
}

// ============================================
// 管理者ユーザー詳細キャッシュ
// ============================================

export async function getAdminUserDetailCache<T>(userId: string): Promise<T | null> {
  return getCache<T>(`${KEY_PREFIX.ADMIN_USER_DETAIL}${userId}`, '管理者ユーザー詳細キャッシュの取得に失敗');
}

export async function setAdminUserDetailCache<T>(userId: string, data: T, ttlSeconds: number = 30): Promise<boolean> {
  return setCache(`${KEY_PREFIX.ADMIN_USER_DETAIL}${userId}`, data, ttlSeconds, '管理者ユーザー詳細キャッシュの保存に失敗');
}

export async function invalidateAdminUserDetailCache(userId: string): Promise<boolean> {
  return invalidateCache(`${KEY_PREFIX.ADMIN_USER_DETAIL}${userId}`, '管理者ユーザー詳細キャッシュの無効化に失敗');
}

// ============================================
// 管理者組織一覧キャッシュ
// ============================================

export async function setAdminOrganizationsCache<T>(
  params: Record<string, unknown>, data: T, ttlSeconds: number = 60
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.ADMIN_ORGANIZATIONS, params),
    data, ttlSeconds, '管理者組織一覧キャッシュの保存に失敗'
  );
}

export async function getAdminOrganizationsCache<T>(params: Record<string, unknown>): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.ADMIN_ORGANIZATIONS, params),
    '管理者組織一覧キャッシュの取得に失敗'
  );
}

export async function invalidateAdminOrganizationsCache(): Promise<boolean> {
  return invalidateCacheByPattern(`${KEY_PREFIX.ADMIN_ORGANIZATIONS}*`, '管理者組織一覧キャッシュの無効化に失敗');
}

// ============================================
// 管理者組織詳細キャッシュ
// ============================================

export async function getAdminOrganizationDetailCache<T>(organizationId: string): Promise<T | null> {
  return getCache<T>(`${KEY_PREFIX.ADMIN_ORGANIZATION_DETAIL}${organizationId}`, '管理者組織詳細キャッシュの取得に失敗');
}

export async function setAdminOrganizationDetailCache<T>(organizationId: string, data: T, ttlSeconds: number = 30): Promise<boolean> {
  return setCache(`${KEY_PREFIX.ADMIN_ORGANIZATION_DETAIL}${organizationId}`, data, ttlSeconds, '管理者組織詳細キャッシュの保存に失敗');
}

export async function invalidateAdminOrganizationDetailCache(organizationId: string): Promise<boolean> {
  return invalidateCache(`${KEY_PREFIX.ADMIN_ORGANIZATION_DETAIL}${organizationId}`, '管理者組織詳細キャッシュの無効化に失敗');
}

// ============================================
// 管理者監査ログキャッシュ
// ============================================

export async function setAdminAuditLogsCache<T>(
  params: Record<string, unknown>, data: T, ttlSeconds: number = 30
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.ADMIN_AUDIT_LOGS, params),
    data, ttlSeconds, '管理者監査ログキャッシュの保存に失敗'
  );
}

export async function getAdminAuditLogsCache<T>(params: Record<string, unknown>): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.ADMIN_AUDIT_LOGS, params),
    '管理者監査ログキャッシュの取得に失敗'
  );
}
