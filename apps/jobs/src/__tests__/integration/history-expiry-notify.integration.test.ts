/**
 * history-expiry-notify 結合テスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestUser,
  createTestSubscription,
  createTestProject,
  createTestSuite,
  createTestCase,
  createTestCaseHistory,
  cleanupTestData,
  daysAgo,
} from './test-helpers.js';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockSendEmail, mockGenerateEmail } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockGenerateEmail: vi.fn(),
}));

vi.mock('../../lib/email.js', () => ({
  sendEmail: mockSendEmail,
  generateHistoryExpiryEmail: mockGenerateEmail,
}));

// モック設定後にインポート
import { runHistoryExpiryNotify } from '../../jobs/history-expiry-notify.js';

describe('runHistoryExpiryNotify（結合テスト）', () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // デフォルトのメール生成
    mockGenerateEmail.mockReturnValue({
      subject: '履歴削除予告',
      text: 'テスト本文',
      html: '<p>テストHTML</p>',
    });
    mockSendEmail.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cleanupTestData();
    vi.restoreAllMocks();
  });

  it('削除7日前の履歴を持つFREEユーザーに通知を送信する', async () => {
    // FREEユーザー
    const user = await createTestUser({
      email: 'notify@test.com',
      name: 'Notify User',
      plan: 'FREE',
    });
    await createTestSubscription({ userId: user.id, plan: 'FREE' });
    const project = await createTestProject(user.id);
    const suite = await createTestSuite(project.id);
    const testCase = await createTestCase(suite.id);

    // 23日前の履歴（30日 - 7日 = 23日前が通知対象）
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(23) });
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(25) });
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(28) });

    await runHistoryExpiryNotify();

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'notify@test.com',
      subject: '履歴削除予告',
      text: 'テスト本文',
      html: '<p>テストHTML</p>',
    });
    // 履歴件数3件で通知
    expect(mockGenerateEmail).toHaveBeenCalledWith('Notify User', 7, 3);
  });

  it('削除対象履歴がないユーザーには通知しない', async () => {
    // FREEユーザー（新しい履歴のみ）
    const user = await createTestUser({
      email: 'nonotify@test.com',
      plan: 'FREE',
    });
    await createTestSubscription({ userId: user.id, plan: 'FREE' });
    const project = await createTestProject(user.id);
    const suite = await createTestSuite(project.id);
    const testCase = await createTestCase(suite.id);

    // 10日前の履歴（通知対象外）
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(10) });

    await runHistoryExpiryNotify();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('PROユーザーには通知しない', async () => {
    // PROユーザー
    const user = await createTestUser({
      email: 'pro@test.com',
      plan: 'PRO',
    });
    await createTestSubscription({ userId: user.id, plan: 'PRO' });
    const project = await createTestProject(user.id);
    const suite = await createTestSuite(project.id);
    const testCase = await createTestCase(suite.id);

    // 古い履歴（PROなので通知されない）
    await createTestCaseHistory(testCase.id, { createdAt: daysAgo(100) });

    await runHistoryExpiryNotify();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('プロジェクトを持たないユーザーには通知しない', async () => {
    // FREEユーザー（プロジェクトなし）
    const user = await createTestUser({
      email: 'noproject@test.com',
      plan: 'FREE',
    });
    await createTestSubscription({ userId: user.id, plan: 'FREE' });

    await runHistoryExpiryNotify();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('メール送信エラー時も他のユーザーには通知を継続する', async () => {
    // ユーザー1（送信失敗）
    const user1 = await createTestUser({
      email: 'fail@test.com',
      name: 'Fail User',
      plan: 'FREE',
    });
    await createTestSubscription({ userId: user1.id, plan: 'FREE' });
    const project1 = await createTestProject(user1.id);
    const suite1 = await createTestSuite(project1.id);
    const case1 = await createTestCase(suite1.id);
    await createTestCaseHistory(case1.id, { createdAt: daysAgo(24) });

    // ユーザー2（送信成功）
    const user2 = await createTestUser({
      email: 'success@test.com',
      name: 'Success User',
      plan: 'FREE',
    });
    await createTestSubscription({ userId: user2.id, plan: 'FREE' });
    const project2 = await createTestProject(user2.id);
    const suite2 = await createTestSuite(project2.id);
    const case2 = await createTestCase(suite2.id);
    await createTestCaseHistory(case2.id, { createdAt: daysAgo(24) });

    // 1人目は失敗、2人目は成功
    mockSendEmail
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce(undefined);

    await runHistoryExpiryNotify();

    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('通知送信に失敗'),
      expect.any(Error)
    );
  });

  it('複数ユーザーへの通知を適切に処理する', async () => {
    // 通知対象ユーザー3人
    for (let i = 0; i < 3; i++) {
      const user = await createTestUser({
        email: `user${i}@test.com`,
        name: `User ${i}`,
        plan: 'FREE',
      });
      await createTestSubscription({ userId: user.id, plan: 'FREE' });
      const project = await createTestProject(user.id);
      const suite = await createTestSuite(project.id);
      const testCase = await createTestCase(suite.id);
      await createTestCaseHistory(testCase.id, { createdAt: daysAgo(24) });
    }

    await runHistoryExpiryNotify();

    expect(mockSendEmail).toHaveBeenCalledTimes(3);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('通知完了: 成功 3件, 失敗 0件')
    );
  });
});
