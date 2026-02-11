import type { Notification } from './api';

/** パスセグメントとして安全な文字のみ許可（英数字、ハイフン、アンダースコア） */
const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/;

/**
 * data から指定キーの文字列プロパティを安全に取得する
 * 非文字列・空文字列・パスセグメントとして不正な値の場合は null を返す
 */
function getStringProp(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  if (typeof value === 'string' && value.length > 0 && SAFE_PATH_SEGMENT.test(value)) {
    return value;
  }
  return null;
}

/**
 * 通知タイプに応じたナビゲーション先パスを返す
 * ナビゲーション不要またはデータ不足の場合は null を返す
 */
export function getNotificationNavigationPath(notification: Notification): string | null {
  const { type, data } = notification;

  if (!data) {
    return null;
  }

  switch (type) {
    case 'ORG_INVITATION': {
      const token = getStringProp(data, 'inviteToken');
      return token ? `/invitations/${token}` : null;
    }
    case 'INVITATION_ACCEPTED': {
      const orgId = getStringProp(data, 'organizationId');
      return orgId ? `/organizations/${orgId}/settings` : null;
    }
    case 'PROJECT_ADDED': {
      const projectId = getStringProp(data, 'projectId');
      return projectId ? `/projects/${projectId}` : null;
    }
    case 'REVIEW_COMMENT': {
      const suiteId = getStringProp(data, 'testSuiteId');
      return suiteId ? `/test-suites/${suiteId}` : null;
    }
    case 'TEST_COMPLETED':
    case 'TEST_FAILED': {
      const execId = getStringProp(data, 'executionId');
      return execId ? `/executions/${execId}` : null;
    }
    default:
      return null;
  }
}
