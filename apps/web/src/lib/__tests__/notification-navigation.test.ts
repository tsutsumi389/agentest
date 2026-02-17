import { describe, it, expect } from 'vitest';
import type { Notification } from '../api';
import { createMockNotification } from '../../__tests__/factories';
import { getNotificationNavigationPath } from '../notification-navigation';

describe('getNotificationNavigationPath', () => {
  describe('ORG_INVITATION', () => {
    it('inviteToken がある場合、招待ページのパスを返す', () => {
      const notification = createMockNotification({
        type: 'ORG_INVITATION',
        data: { inviteToken: 'token-abc' },
      });
      expect(getNotificationNavigationPath(notification)).toBe('/invitations/token-abc');
    });

    it('inviteToken が欠損している場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'ORG_INVITATION',
        data: { otherKey: 'value' },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });

  describe('INVITATION_ACCEPTED', () => {
    it('organizationId がある場合、組織設定ページのパスを返す', () => {
      const notification = createMockNotification({
        type: 'INVITATION_ACCEPTED',
        data: { organizationId: 'org-123' },
      });
      expect(getNotificationNavigationPath(notification)).toBe('/organizations/org-123/settings');
    });

    it('organizationId が欠損している場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'INVITATION_ACCEPTED',
        data: {},
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });

  describe('PROJECT_ADDED', () => {
    it('projectId がある場合、プロジェクトページのパスを返す', () => {
      const notification = createMockNotification({
        type: 'PROJECT_ADDED',
        data: { projectId: 'proj-456' },
      });
      expect(getNotificationNavigationPath(notification)).toBe('/projects/proj-456');
    });

    it('projectId が欠損している場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'PROJECT_ADDED',
        data: { something: 'else' },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });

  describe('REVIEW_COMMENT', () => {
    it('testSuiteId がある場合、テストスイートページのパスを返す', () => {
      const notification = createMockNotification({
        type: 'REVIEW_COMMENT',
        data: { testSuiteId: 'suite-789' },
      });
      expect(getNotificationNavigationPath(notification)).toBe('/test-suites/suite-789');
    });

    it('testSuiteId が欠損している場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'REVIEW_COMMENT',
        data: {},
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });

  describe('TEST_COMPLETED', () => {
    it('executionId がある場合、実行結果ページのパスを返す', () => {
      const notification = createMockNotification({
        type: 'TEST_COMPLETED',
        data: { executionId: 'exec-001' },
      });
      expect(getNotificationNavigationPath(notification)).toBe('/executions/exec-001');
    });

    it('executionId が欠損している場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'TEST_COMPLETED',
        data: {},
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });

  describe('TEST_FAILED', () => {
    it('executionId がある場合、実行結果ページのパスを返す', () => {
      const notification = createMockNotification({
        type: 'TEST_FAILED',
        data: { executionId: 'exec-002' },
      });
      expect(getNotificationNavigationPath(notification)).toBe('/executions/exec-002');
    });

    it('executionId が欠損している場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'TEST_FAILED',
        data: { wrongKey: 'value' },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });

  describe('ナビゲーションなしのタイプ', () => {
    it('SECURITY_ALERT は null を返す', () => {
      const notification = createMockNotification({
        type: 'SECURITY_ALERT',
        data: { someKey: 'value' },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });

  describe('data が null の場合', () => {
    it.each([
      'ORG_INVITATION',
      'INVITATION_ACCEPTED',
      'PROJECT_ADDED',
      'REVIEW_COMMENT',
      'TEST_COMPLETED',
      'TEST_FAILED',
      'SECURITY_ALERT',
    ] as const)('%s で data: null の場合、null を返す', (type) => {
      const notification = createMockNotification({ type, data: null });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });

  describe('エッジケース', () => {
    it('プロパティが空文字列の場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'ORG_INVITATION',
        data: { inviteToken: '' },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });

    it('プロパティが非文字列（数値）の場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'ORG_INVITATION',
        data: { inviteToken: 12345 },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });

    it('未知の通知タイプの場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'UNKNOWN_TYPE' as Notification['type'],
        data: { someKey: 'value' },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });

    it('パストラバーサルを含む値の場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'ORG_INVITATION',
        data: { inviteToken: '../../../admin' },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });

    it('スラッシュを含む値の場合、null を返す', () => {
      const notification = createMockNotification({
        type: 'ORG_INVITATION',
        data: { inviteToken: 'token/evil' },
      });
      expect(getNotificationNavigationPath(notification)).toBeNull();
    });
  });
});
