/**
 * テスト用モックファクトリ
 * 型安全なモックデータを生成する
 */
import type {
  User,
  Organization,
  Notification,
  NotificationPreference,
  UpdateUserRequest,
} from '../lib/api';

/** デフォルトの通知取得件数 */
export const DEFAULT_NOTIFICATION_LIMIT = 20;

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'テストユーザー',
    avatarUrl: null,
    plan: 'FREE',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'テスト組織',
    description: null,
    avatarUrl: null,
    billingEmail: null,
    plan: 'FREE',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    userId: 'user-1',
    type: 'ORG_INVITATION',
    title: 'テスト通知',
    body: 'テスト本文',
    data: null,
    readAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockNotificationPreference(
  overrides: Partial<NotificationPreference> = {}
): NotificationPreference {
  return {
    type: 'ORG_INVITATION',
    emailEnabled: true,
    inAppEnabled: true,
    ...overrides,
  };
}

export function createMockUpdateUserRequest(
  overrides: Partial<UpdateUserRequest> = {}
): UpdateUserRequest {
  return {
    name: 'テストユーザー',
    ...overrides,
  };
}
