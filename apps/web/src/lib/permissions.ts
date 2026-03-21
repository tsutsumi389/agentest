import type { ProjectMemberRole } from './api';

/** 書き込み権限を持つロール */
const WRITABLE_ROLES = new Set<string>(['OWNER', 'ADMIN', 'WRITE']);

/**
 * プロジェクトの編集権限があるかを判定
 */
export function hasWritePermission(role?: 'OWNER' | ProjectMemberRole): boolean {
  return !!role && WRITABLE_ROLES.has(role);
}
