/**
 * project-cleanup 結合テスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../../lib/prisma.js';
import { runProjectCleanup } from '../../jobs/project-cleanup.js';
import {
  createTestUser,
  createTestProject,
  createDeletedTestProject,
  createTestSuite,
  createTestCase,
  cleanupTestData,
  daysAgo,
} from './test-helpers.js';

const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

describe('runProjectCleanup（結合テスト）', () => {
  // テストの時刻を固定して境界条件の安定性を確保
  const testDate = new Date('2025-05-15T12:00:00.000Z');

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(testDate);
    await cleanupTestData();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTestData();
    vi.useRealTimers();
  });

  it('31日前に削除されたプロジェクトを物理削除する', async () => {
    const user = await createTestUser();
    // 31日前に削除されたプロジェクト
    const deletedProject = await createDeletedTestProject(user.id, daysAgo(31));

    await runProjectCleanup();

    // プロジェクトが物理削除されている
    const project = await prisma.project.findUnique({
      where: { id: deletedProject.id },
    });
    expect(project).toBeNull();

    // ProjectMemberも削除されている
    const members = await prisma.projectMember.findMany({
      where: { projectId: deletedProject.id },
    });
    expect(members).toHaveLength(0);
  });

  it('29日前に削除されたプロジェクトは削除されない', async () => {
    const user = await createTestUser();
    // 29日前に削除されたプロジェクト（30日未満なので削除されない）
    const deletedProject = await createDeletedTestProject(user.id, daysAgo(29));

    await runProjectCleanup();

    // プロジェクトが残っている
    const project = await prisma.project.findUnique({
      where: { id: deletedProject.id },
    });
    expect(project).not.toBeNull();
    expect(project?.deletedAt).not.toBeNull();
  });

  it('deletedAtがnullのプロジェクトは削除されない', async () => {
    const user = await createTestUser();
    // 通常のプロジェクト（deletedAt = null）
    const activeProject = await createTestProject(user.id);

    await runProjectCleanup();

    // プロジェクトが残っている
    const project = await prisma.project.findUnique({
      where: { id: activeProject.id },
    });
    expect(project).not.toBeNull();
    expect(project?.deletedAt).toBeNull();
  });

  it('カスケード削除で関連データも削除される', async () => {
    const user = await createTestUser();
    // 31日前に削除されたプロジェクト
    const deletedProject = await createDeletedTestProject(user.id, daysAgo(31));

    // プロジェクトに関連データを作成
    const testSuite = await createTestSuite(deletedProject.id);
    const testCase = await createTestCase(testSuite.id);

    await runProjectCleanup();

    // プロジェクトが物理削除されている
    const project = await prisma.project.findUnique({
      where: { id: deletedProject.id },
    });
    expect(project).toBeNull();

    // TestSuiteも削除されている
    const suite = await prisma.testSuite.findUnique({
      where: { id: testSuite.id },
    });
    expect(suite).toBeNull();

    // TestCaseも削除されている
    const tc = await prisma.testCase.findUnique({
      where: { id: testCase.id },
    });
    expect(tc).toBeNull();
  });

  it('複数プロジェクトを適切に処理する', async () => {
    const user = await createTestUser();

    // 削除対象（31日以上前）
    const oldDeleted1 = await createDeletedTestProject(
      user.id,
      daysAgo(31),
      { name: 'Old Deleted 1' }
    );
    const oldDeleted2 = await createDeletedTestProject(
      user.id,
      daysAgo(60),
      { name: 'Old Deleted 2' }
    );

    // 削除対象外（30日未満）
    const recentDeleted = await createDeletedTestProject(
      user.id,
      daysAgo(15),
      { name: 'Recent Deleted' }
    );

    // 削除対象外（アクティブ）
    const activeProject = await createTestProject(user.id, {
      name: 'Active Project',
    });

    await runProjectCleanup();

    // 古い削除プロジェクトは物理削除される
    const old1 = await prisma.project.findUnique({ where: { id: oldDeleted1.id } });
    const old2 = await prisma.project.findUnique({ where: { id: oldDeleted2.id } });
    expect(old1).toBeNull();
    expect(old2).toBeNull();

    // 最近の削除プロジェクトは残る
    const recent = await prisma.project.findUnique({ where: { id: recentDeleted.id } });
    expect(recent).not.toBeNull();

    // アクティブプロジェクトは残る
    const active = await prisma.project.findUnique({ where: { id: activeProject.id } });
    expect(active).not.toBeNull();
  });

  it('ちょうど30日前に削除されたプロジェクトは削除されない', async () => {
    const user = await createTestUser();
    // ちょうど30日前に削除されたプロジェクト
    // daysAgo(30)とcutoffDateが同じ値になるため、lt条件を満たさず削除されない
    const deletedProject = await createDeletedTestProject(user.id, daysAgo(30));

    await runProjectCleanup();

    // ちょうど30日前のプロジェクトはまだ削除されない（lt条件のため）
    const project = await prisma.project.findUnique({
      where: { id: deletedProject.id },
    });
    expect(project).not.toBeNull();
  });

  it('削除対象がない場合でも正常に完了する', async () => {
    const user = await createTestUser();
    // アクティブなプロジェクトのみ
    await createTestProject(user.id);

    await expect(runProjectCleanup()).resolves.not.toThrow();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalDeleted: 0 }),
      'プロジェクトの物理削除が完了しました'
    );
  });
});
