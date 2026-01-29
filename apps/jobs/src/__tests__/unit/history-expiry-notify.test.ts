/**
 * history-expiry-notify ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockPrisma, mockSendEmail, mockGenerateEmail } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findMany: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
    },
    testCaseHistory: {
      count: vi.fn(),
    },
  },
  mockSendEmail: vi.fn(),
  mockGenerateEmail: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../lib/email.js', () => ({
  sendEmail: mockSendEmail,
  generateHistoryExpiryEmail: mockGenerateEmail,
}));

// モック設定後にインポート
import { runHistoryExpiryNotify } from '../../jobs/history-expiry-notify.js';

describe('runHistoryExpiryNotify', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
  };
  const mockProjects = [{ projectId: 'proj-1' }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-15T00:00:00.000Z'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // デフォルトのメール生成
    mockGenerateEmail.mockReturnValue({
      subject: 'テスト件名',
      text: 'テスト本文',
      html: '<p>テストHTML</p>',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('削除7日前のFREEユーザーへ通知メールを送信する', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.count.mockResolvedValue(50);
    mockSendEmail.mockResolvedValue(undefined);

    await runHistoryExpiryNotify();

    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: 'テスト件名',
      text: 'テスト本文',
      html: '<p>テストHTML</p>',
    });
  });

  it('削除予定履歴がないユーザーはスキップする', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.count.mockResolvedValue(0); // 履歴なし

    await runHistoryExpiryNotify();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('プロジェクトを持たないユーザーはスキップする', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue([]); // プロジェクトなし

    await runHistoryExpiryNotify();

    expect(mockPrisma.testCaseHistory.count).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('メール送信エラー時も処理を継続する', async () => {
    const user2 = { id: 'user-2', email: 'test2@example.com', name: 'User 2' };
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockUser, user2])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.count.mockResolvedValue(30);

    // 1人目は失敗、2人目は成功
    mockSendEmail
      .mockRejectedValueOnce(new Error('SMTP error'))
      .mockResolvedValueOnce(undefined);

    await runHistoryExpiryNotify();

    // 両方にメール送信を試みる
    expect(mockSendEmail).toHaveBeenCalledTimes(2);

    // エラーログが出力される
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`ユーザー ${mockUser.id} への通知送信に失敗`),
      expect.any(Error)
    );
  });

  it('成功・失敗カウントを集計する', async () => {
    const users = [
      { id: 'user-1', email: 'a@test.com', name: 'A' },
      { id: 'user-2', email: 'b@test.com', name: 'B' },
      { id: 'user-3', email: 'c@test.com', name: 'C' },
    ];
    mockPrisma.user.findMany
      .mockResolvedValueOnce(users)
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.count.mockResolvedValue(20);

    // 1人成功、1人失敗、1人成功
    mockSendEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    await runHistoryExpiryNotify();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('通知完了: 成功 2件, 失敗 1件')
    );
  });

  it('generateHistoryExpiryEmailに正しい引数を渡す', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue(mockProjects);
    mockPrisma.testCaseHistory.count.mockResolvedValue(100);
    mockSendEmail.mockResolvedValue(undefined);

    await runHistoryExpiryNotify();

    // 7日前の通知であること、履歴件数が正しいことを確認
    expect(mockGenerateEmail).toHaveBeenCalledWith('Test User', 7, 100);
  });

  it('FREEプランユーザーのみをクエリする', async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    await runHistoryExpiryNotify();

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subscription: { plan: 'FREE' },
        },
      })
    );
  });

  it('個人プロジェクトのみを対象とする', async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([mockUser])
      .mockResolvedValueOnce([]);
    mockPrisma.projectMember.findMany.mockResolvedValue([]);

    await runHistoryExpiryNotify();

    expect(mockPrisma.projectMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: {
            organizationId: null,
          },
        }),
      })
    );
  });
});
