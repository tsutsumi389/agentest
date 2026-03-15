import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError, BadRequestError } from '@agentest/shared';

// Prismaモック（validateTargetItem, getTestSuiteProjectId, addComment通知用）
const mockPrisma = vi.hoisted(() => ({
  testSuite: { findFirst: vi.fn(), findUnique: vi.fn() },
  testSuitePrecondition: { findFirst: vi.fn() },
  testCasePrecondition: { findFirst: vi.fn() },
  testCaseStep: { findFirst: vi.fn() },
  testCaseExpectedResult: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// ReviewRepositoryモック
const mockReviewRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  searchByTestSuite: vi.fn(),
  findDraftsByUser: vi.fn(),
  findDraftByUserAndTestSuite: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateVerdict: vi.fn(),
  submit: vi.fn(),
  delete: vi.fn(),
  addComment: vi.fn(),
  findCommentById: vi.fn(),
  updateComment: vi.fn(),
  updateCommentStatus: vi.fn(),
  deleteComment: vi.fn(),
  addReply: vi.fn(),
  findReplyById: vi.fn(),
  updateReply: vi.fn(),
  deleteReply: vi.fn(),
  getOpenCommentCount: vi.fn(),
}));

vi.mock('../../repositories/review.repository.js', () => ({
  ReviewRepository: vi.fn().mockImplementation(() => mockReviewRepo),
}));

// AuthorizationServiceモック
const mockAuthorizationService = vi.hoisted(() => ({
  checkProjectRole: vi.fn(),
}));

vi.mock('../../services/authorization.service.js', () => ({
  authorizationService: mockAuthorizationService,
  AuthorizationService: vi.fn(),
}));

// NotificationServiceモック
const mockNotificationService = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('../../services/notification.service.js', () => ({
  notificationService: mockNotificationService,
  NotificationService: vi.fn(),
}));

import { ReviewService } from '../../services/review.service.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
const TEST_REVIEW_ID = '33333333-3333-3333-3333-333333333333';
const TEST_SUITE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_PROJECT_ID = '55555555-5555-5555-5555-555555555555';

// テスト用のレビューモックデータ
const createMockReview = (overrides = {}) => ({
  id: TEST_REVIEW_ID,
  testSuiteId: TEST_SUITE_ID,
  authorUserId: TEST_USER_ID,
  status: 'DRAFT',
  verdict: null,
  summary: null,
  author: { id: TEST_USER_ID, name: 'Test User', avatarUrl: null },
  agentSession: null,
  comments: [],
  _count: { comments: 0 },
  ...overrides,
});

describe('ReviewService（コア操作）', () => {
  let service: ReviewService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReviewService();
  });

  describe('findById', () => {
    it('レビューを取得できる', async () => {
      const mockReview = createMockReview();
      mockReviewRepo.findById.mockResolvedValue(mockReview);

      const result = await service.findById(TEST_REVIEW_ID);

      expect(result).toEqual(mockReview);
      expect(mockReviewRepo.findById).toHaveBeenCalledWith(TEST_REVIEW_ID);
    });

    it('存在しないレビューはNotFoundErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(null);

      await expect(service.findById(TEST_REVIEW_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('searchByTestSuite', () => {
    it('テストスイートのレビュー一覧を検索できる', async () => {
      mockPrisma.testSuite.findFirst.mockResolvedValue({ projectId: TEST_PROJECT_ID });
      mockReviewRepo.searchByTestSuite.mockResolvedValue({ items: [], total: 0 });

      const result = await service.searchByTestSuite(TEST_SUITE_ID, { limit: 10, offset: 0 });

      expect(result).toEqual({ items: [], total: 0 });
      expect(mockReviewRepo.searchByTestSuite).toHaveBeenCalledWith(TEST_SUITE_ID, {
        limit: 10,
        offset: 0,
      });
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testSuite.findFirst.mockResolvedValue(null);

      await expect(
        service.searchByTestSuite(TEST_SUITE_ID, { limit: 10, offset: 0 })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getDraftsByUser', () => {
    it('ユーザーの下書き一覧を取得できる', async () => {
      const mockDrafts = [createMockReview()];
      mockReviewRepo.findDraftsByUser.mockResolvedValue(mockDrafts);

      const result = await service.getDraftsByUser(TEST_USER_ID);

      expect(result).toEqual(mockDrafts);
      expect(mockReviewRepo.findDraftsByUser).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  describe('startReview', () => {
    beforeEach(() => {
      mockPrisma.testSuite.findFirst.mockResolvedValue({ projectId: TEST_PROJECT_ID });
      mockAuthorizationService.checkProjectRole.mockResolvedValue(true);
      mockReviewRepo.findDraftByUserAndTestSuite.mockResolvedValue(null);
    });

    it('レビューを開始できる', async () => {
      const mockReview = createMockReview();
      mockReviewRepo.create.mockResolvedValue(mockReview);

      const result = await service.startReview(TEST_USER_ID, {
        testSuiteId: TEST_SUITE_ID,
        summary: 'テストサマリー',
      });

      expect(result).toEqual(mockReview);
      expect(mockAuthorizationService.checkProjectRole).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_PROJECT_ID,
        ['ADMIN', 'WRITE']
      );
      expect(mockReviewRepo.create).toHaveBeenCalledWith({
        testSuiteId: TEST_SUITE_ID,
        authorUserId: TEST_USER_ID,
        summary: 'テストサマリー',
      });
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testSuite.findFirst.mockResolvedValue(null);

      await expect(
        service.startReview(TEST_USER_ID, { testSuiteId: TEST_SUITE_ID })
      ).rejects.toThrow(NotFoundError);
    });

    it('権限がない場合はAuthorizationErrorを投げる', async () => {
      mockAuthorizationService.checkProjectRole.mockResolvedValue(false);

      await expect(
        service.startReview(TEST_USER_ID, { testSuiteId: TEST_SUITE_ID })
      ).rejects.toThrow(AuthorizationError);
    });

    it('既存の下書きがある場合はBadRequestErrorを投げる', async () => {
      mockReviewRepo.findDraftByUserAndTestSuite.mockResolvedValue(createMockReview());

      await expect(
        service.startReview(TEST_USER_ID, { testSuiteId: TEST_SUITE_ID })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('update', () => {
    it('投稿者本人がDRAFTレビューを更新できる', async () => {
      const mockReview = createMockReview();
      mockReviewRepo.findById.mockResolvedValue(mockReview);
      const updatedReview = { ...mockReview, summary: '更新' };
      mockReviewRepo.update.mockResolvedValue(updatedReview);

      const result = await service.update(TEST_REVIEW_ID, TEST_USER_ID, { summary: '更新' });

      expect(result).toEqual(updatedReview);
    });

    it('他人のレビューはAuthorizationErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview());

      await expect(
        service.update(TEST_REVIEW_ID, OTHER_USER_ID, { summary: '更新' })
      ).rejects.toThrow(AuthorizationError);
    });

    it('SUBMITTED状態のレビューはBadRequestErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));

      await expect(
        service.update(TEST_REVIEW_ID, TEST_USER_ID, { summary: '更新' })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('submit', () => {
    it('投稿者本人がDRAFTレビューを提出できる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview());
      const submittedReview = createMockReview({ status: 'SUBMITTED', verdict: 'APPROVED' });
      mockReviewRepo.submit.mockResolvedValue(submittedReview);

      const result = await service.submit(TEST_REVIEW_ID, TEST_USER_ID, { verdict: 'APPROVED' });

      expect(result).toEqual(submittedReview);
      expect(mockReviewRepo.submit).toHaveBeenCalledWith(TEST_REVIEW_ID, { verdict: 'APPROVED' });
    });

    it('他人のレビューはAuthorizationErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview());

      await expect(
        service.submit(TEST_REVIEW_ID, OTHER_USER_ID, { verdict: 'APPROVED' })
      ).rejects.toThrow(AuthorizationError);
    });

    it('SUBMITTED状態のレビューはBadRequestErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));

      await expect(
        service.submit(TEST_REVIEW_ID, TEST_USER_ID, { verdict: 'APPROVED' })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('updateVerdict', () => {
    it('投稿者本人がSUBMITTED状態の評価を変更できる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));
      const updatedReview = createMockReview({ status: 'SUBMITTED', verdict: 'CHANGES_REQUESTED' });
      mockReviewRepo.updateVerdict.mockResolvedValue(updatedReview);

      const result = await service.updateVerdict(TEST_REVIEW_ID, TEST_USER_ID, {
        verdict: 'CHANGES_REQUESTED',
      });

      expect(result).toEqual(updatedReview);
      expect(mockReviewRepo.updateVerdict).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        'CHANGES_REQUESTED'
      );
    });

    it('他人のレビューはAuthorizationErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));

      await expect(
        service.updateVerdict(TEST_REVIEW_ID, OTHER_USER_ID, { verdict: 'CHANGES_REQUESTED' })
      ).rejects.toThrow(AuthorizationError);
    });

    it('DRAFT状態のレビューはBadRequestErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'DRAFT' }));

      await expect(
        service.updateVerdict(TEST_REVIEW_ID, TEST_USER_ID, { verdict: 'CHANGES_REQUESTED' })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('delete', () => {
    it('投稿者本人がDRAFTレビューを削除できる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview());
      mockReviewRepo.delete.mockResolvedValue({ id: TEST_REVIEW_ID });

      await service.delete(TEST_REVIEW_ID, TEST_USER_ID);

      expect(mockReviewRepo.delete).toHaveBeenCalledWith(TEST_REVIEW_ID);
    });

    it('他人のレビューはAuthorizationErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview());

      await expect(service.delete(TEST_REVIEW_ID, OTHER_USER_ID)).rejects.toThrow(
        AuthorizationError
      );
    });

    it('SUBMITTED状態のレビューはBadRequestErrorを投げる', async () => {
      mockReviewRepo.findById.mockResolvedValue(createMockReview({ status: 'SUBMITTED' }));

      await expect(service.delete(TEST_REVIEW_ID, TEST_USER_ID)).rejects.toThrow(BadRequestError);
    });
  });

  describe('getAccessibleReview', () => {
    it('SUBMITTEDレビューは誰でもアクセスできる', async () => {
      const review = createMockReview({ status: 'SUBMITTED' });
      mockReviewRepo.findById.mockResolvedValue(review);

      const result = await service.getAccessibleReview(TEST_REVIEW_ID, OTHER_USER_ID);

      expect(result).toEqual(review);
    });

    it('DRAFTレビューは投稿者本人のみアクセスできる', async () => {
      const review = createMockReview({ status: 'DRAFT' });
      mockReviewRepo.findById.mockResolvedValue(review);

      const result = await service.getAccessibleReview(TEST_REVIEW_ID, TEST_USER_ID);

      expect(result).toEqual(review);
    });

    it('他人のDRAFTレビューはnullを返す', async () => {
      const review = createMockReview({ status: 'DRAFT' });
      mockReviewRepo.findById.mockResolvedValue(review);

      const result = await service.getAccessibleReview(TEST_REVIEW_ID, OTHER_USER_ID);

      expect(result).toBeNull();
    });

    it('レビューが存在しない場合はnullを返す', async () => {
      mockReviewRepo.findById.mockResolvedValue(null);

      const result = await service.getAccessibleReview(TEST_REVIEW_ID, TEST_USER_ID);

      expect(result).toBeNull();
    });
  });
});
