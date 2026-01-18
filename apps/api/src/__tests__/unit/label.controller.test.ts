import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { LabelController } from '../../controllers/label.controller.js';
import { NotFoundError, ValidationError } from '@agentest/shared';

// LabelService のモック
const mockLabelService = {
  getByProjectId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getTestSuiteLabels: vi.fn(),
  updateTestSuiteLabels: vi.fn(),
};

vi.mock('../../services/label.service.js', () => ({
  LabelService: vi.fn().mockImplementation(() => mockLabelService),
}));

// テスト用の固定値
const TEST_PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_LABEL_ID = '22222222-2222-2222-2222-222222222222';
const TEST_LABEL_ID_2 = '33333333-3333-3333-3333-333333333333';
const TEST_SUITE_ID = '44444444-4444-4444-4444-444444444444';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  params: { projectId: TEST_PROJECT_ID },
  body: {},
  query: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('LabelController', () => {
  let controller: LabelController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LabelController();
    mockNext = vi.fn();
  });

  describe('getLabels', () => {
    it('ラベル一覧を取得できる', async () => {
      const mockLabels = [
        { id: 'label-1', name: 'Bug', color: '#FF0000' },
        { id: 'label-2', name: 'Feature', color: '#00FF00' },
      ];
      mockLabelService.getByProjectId.mockResolvedValue(mockLabels);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getLabels(req, res, mockNext);

      expect(mockLabelService.getByProjectId).toHaveBeenCalledWith(TEST_PROJECT_ID);
      expect(res.json).toHaveBeenCalledWith({ labels: mockLabels });
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('Project', TEST_PROJECT_ID);
      mockLabelService.getByProjectId.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getLabels(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createLabel', () => {
    it('ラベルを作成できる（201）', async () => {
      const mockLabel = {
        id: TEST_LABEL_ID,
        projectId: TEST_PROJECT_ID,
        name: 'Bug',
        description: null,
        color: '#FF0000',
      };
      mockLabelService.create.mockResolvedValue(mockLabel);

      const req = mockRequest({
        body: { name: 'Bug', color: '#FF0000' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.createLabel(req, res, mockNext);

      expect(mockLabelService.create).toHaveBeenCalledWith(TEST_PROJECT_ID, {
        name: 'Bug',
        color: '#FF0000',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ label: mockLabel });
    });

    it('バリデーションエラーをnextに渡す', async () => {
      const req = mockRequest({
        body: { name: '', color: '#FF0000' }, // 空の名前
      }) as Request;
      const res = mockResponse() as Response;

      await controller.createLabel(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // ZodErrorがnextに渡されることを確認
      expect((mockNext as vi.Mock).mock.calls[0][0]).toBeDefined();
    });
  });

  describe('updateLabel', () => {
    it('ラベルを更新できる', async () => {
      const mockLabel = {
        id: TEST_LABEL_ID,
        projectId: TEST_PROJECT_ID,
        name: 'Updated Bug',
        color: '#FF0000',
      };
      mockLabelService.update.mockResolvedValue(mockLabel);

      const req = mockRequest({
        params: { projectId: TEST_PROJECT_ID, labelId: TEST_LABEL_ID },
        body: { name: 'Updated Bug' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateLabel(req, res, mockNext);

      expect(mockLabelService.update).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_LABEL_ID, {
        name: 'Updated Bug',
      });
      expect(res.json).toHaveBeenCalledWith({ label: mockLabel });
    });

    it('部分更新が可能', async () => {
      const mockLabel = {
        id: TEST_LABEL_ID,
        projectId: TEST_PROJECT_ID,
        name: 'Bug',
        color: '#00FF00',
      };
      mockLabelService.update.mockResolvedValue(mockLabel);

      const req = mockRequest({
        params: { projectId: TEST_PROJECT_ID, labelId: TEST_LABEL_ID },
        body: { color: '#00FF00' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateLabel(req, res, mockNext);

      expect(mockLabelService.update).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_LABEL_ID, {
        color: '#00FF00',
      });
      expect(res.json).toHaveBeenCalledWith({ label: mockLabel });
    });
  });

  describe('deleteLabel', () => {
    it('ラベルを削除できる（204）', async () => {
      mockLabelService.delete.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { projectId: TEST_PROJECT_ID, labelId: TEST_LABEL_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteLabel(req, res, mockNext);

      expect(mockLabelService.delete).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_LABEL_ID);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('Label', TEST_LABEL_ID);
      mockLabelService.delete.mockRejectedValue(error);

      const req = mockRequest({
        params: { projectId: TEST_PROJECT_ID, labelId: TEST_LABEL_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.deleteLabel(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getTestSuiteLabels', () => {
    it('テストスイートのラベルを取得できる', async () => {
      const mockLabels = [
        { id: 'label-1', name: 'Bug', color: '#FF0000' },
        { id: 'label-2', name: 'Feature', color: '#00FF00' },
      ];
      mockLabelService.getTestSuiteLabels.mockResolvedValue(mockLabels);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getTestSuiteLabels(req, res, mockNext);

      expect(mockLabelService.getTestSuiteLabels).toHaveBeenCalledWith(TEST_SUITE_ID);
      expect(res.json).toHaveBeenCalledWith({ labels: mockLabels });
    });

    it('エラーをnextに渡す', async () => {
      const error = new NotFoundError('TestSuite', TEST_SUITE_ID);
      mockLabelService.getTestSuiteLabels.mockRejectedValue(error);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.getTestSuiteLabels(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateTestSuiteLabels', () => {
    it('テストスイートのラベルを更新できる', async () => {
      const mockLabels = [
        { id: TEST_LABEL_ID, name: 'Bug', color: '#FF0000' },
        { id: TEST_LABEL_ID_2, name: 'Feature', color: '#00FF00' },
      ];
      mockLabelService.updateTestSuiteLabels.mockResolvedValue(mockLabels);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
        body: { labelIds: [TEST_LABEL_ID, TEST_LABEL_ID_2] },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateTestSuiteLabels(req, res, mockNext);

      expect(mockLabelService.updateTestSuiteLabels).toHaveBeenCalledWith(TEST_SUITE_ID, [
        TEST_LABEL_ID,
        TEST_LABEL_ID_2,
      ]);
      expect(res.json).toHaveBeenCalledWith({ labels: mockLabels });
    });

    it('空配列で更新できる', async () => {
      mockLabelService.updateTestSuiteLabels.mockResolvedValue([]);

      const req = mockRequest({
        params: { testSuiteId: TEST_SUITE_ID },
        body: { labelIds: [] },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updateTestSuiteLabels(req, res, mockNext);

      expect(mockLabelService.updateTestSuiteLabels).toHaveBeenCalledWith(TEST_SUITE_ID, []);
      expect(res.json).toHaveBeenCalledWith({ labels: [] });
    });
  });
});
