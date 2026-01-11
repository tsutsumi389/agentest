import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TestCaseService } from '../services/test-case.service.js';

const createTestCaseSchema = z.object({
  testSuiteId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

const updateTestCaseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  groupId: z.string().uuid().optional(),
});

const addPreconditionSchema = z.object({
  content: z.string().min(1).max(2000),
  orderKey: z.string().optional(),
  groupId: z.string().uuid().optional(),
});

const addStepSchema = z.object({
  content: z.string().min(1).max(2000),
  orderKey: z.string().optional(),
  groupId: z.string().uuid().optional(),
});

const addExpectedResultSchema = z.object({
  content: z.string().min(1).max(2000),
  orderKey: z.string().optional(),
  groupId: z.string().uuid().optional(),
});

const updateContentSchema = z.object({
  content: z.string().min(1).max(2000),
  groupId: z.string().uuid().optional(),
});

const reorderPreconditionsSchema = z.object({
  preconditionIds: z.array(z.string().uuid()).min(0),
  groupId: z.string().uuid().optional(),
});

const reorderStepsSchema = z.object({
  stepIds: z.array(z.string().uuid()).min(0),
  groupId: z.string().uuid().optional(),
});

const reorderExpectedResultsSchema = z.object({
  expectedResultIds: z.array(z.string().uuid()).min(0),
  groupId: z.string().uuid().optional(),
});

const copyTestCaseSchema = z.object({
  targetTestSuiteId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
});

const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * テストケースコントローラー
 */
export class TestCaseController {
  private testCaseService = new TestCaseService();

  /**
   * テストケース作成
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createTestCaseSchema.parse(req.body);
      const testCase = await this.testCaseService.create(req.user!.id, data);

      res.status(201).json({ testCase });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケース詳細取得
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const testCase = await this.testCaseService.findById(testCaseId);

      res.json({ testCase });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケース更新
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const { groupId, ...data } = updateTestCaseSchema.parse(req.body);
      const testCase = await this.testCaseService.update(testCaseId, req.user!.id, data, groupId);

      res.json({ testCase });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケース削除
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      await this.testCaseService.softDelete(testCaseId, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 前提条件一覧取得
   */
  getPreconditions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const preconditions = await this.testCaseService.getPreconditions(testCaseId);

      res.json({ preconditions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 前提条件追加
   */
  addPrecondition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const { groupId, ...data } = addPreconditionSchema.parse(req.body);
      const precondition = await this.testCaseService.addPrecondition(testCaseId, req.user!.id, data, groupId);

      res.status(201).json({ precondition });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 前提条件更新
   */
  updatePrecondition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId, preconditionId } = req.params;
      const { groupId, ...data } = updateContentSchema.parse(req.body);
      const precondition = await this.testCaseService.updatePrecondition(testCaseId, preconditionId, req.user!.id, data, groupId);

      res.json({ precondition });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 前提条件削除
   */
  deletePrecondition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId, preconditionId } = req.params;
      // DELETEリクエストでもボディからgroupIdを取得できるようにする
      const { groupId } = z.object({ groupId: z.string().uuid().optional() }).parse(req.body ?? {});
      await this.testCaseService.deletePrecondition(testCaseId, preconditionId, req.user!.id, groupId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 前提条件並び替え
   */
  reorderPreconditions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const { preconditionIds, groupId } = reorderPreconditionsSchema.parse(req.body);
      const preconditions = await this.testCaseService.reorderPreconditions(testCaseId, preconditionIds, req.user!.id, groupId);

      res.json({ preconditions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ステップ一覧取得
   */
  getSteps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const steps = await this.testCaseService.getSteps(testCaseId);

      res.json({ steps });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ステップ追加
   */
  addStep = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const { groupId, ...data } = addStepSchema.parse(req.body);
      const step = await this.testCaseService.addStep(testCaseId, req.user!.id, data, groupId);

      res.status(201).json({ step });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ステップ更新
   */
  updateStep = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId, stepId } = req.params;
      const { groupId, ...data } = updateContentSchema.parse(req.body);
      const step = await this.testCaseService.updateStep(testCaseId, stepId, req.user!.id, data, groupId);

      res.json({ step });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ステップ削除
   */
  deleteStep = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId, stepId } = req.params;
      // DELETEリクエストでもボディからgroupIdを取得できるようにする
      const { groupId } = z.object({ groupId: z.string().uuid().optional() }).parse(req.body ?? {});
      await this.testCaseService.deleteStep(testCaseId, stepId, req.user!.id, groupId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * ステップ並び替え
   */
  reorderSteps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const { stepIds, groupId } = reorderStepsSchema.parse(req.body);
      const steps = await this.testCaseService.reorderSteps(testCaseId, stepIds, req.user!.id, groupId);

      res.json({ steps });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 期待結果一覧取得
   */
  getExpectedResults = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const expectedResults = await this.testCaseService.getExpectedResults(testCaseId);

      res.json({ expectedResults });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 期待結果追加
   */
  addExpectedResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const { groupId, ...data } = addExpectedResultSchema.parse(req.body);
      const expectedResult = await this.testCaseService.addExpectedResult(testCaseId, req.user!.id, data, groupId);

      res.status(201).json({ expectedResult });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 期待結果更新
   */
  updateExpectedResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId, expectedResultId } = req.params;
      const { groupId, ...data } = updateContentSchema.parse(req.body);
      const expectedResult = await this.testCaseService.updateExpectedResult(testCaseId, expectedResultId, req.user!.id, data, groupId);

      res.json({ expectedResult });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 期待結果削除
   */
  deleteExpectedResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId, expectedResultId } = req.params;
      // DELETEリクエストでもボディからgroupIdを取得できるようにする
      const { groupId } = z.object({ groupId: z.string().uuid().optional() }).parse(req.body ?? {});
      await this.testCaseService.deleteExpectedResult(testCaseId, expectedResultId, req.user!.id, groupId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 期待結果並び替え
   */
  reorderExpectedResults = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const { expectedResultIds, groupId } = reorderExpectedResultsSchema.parse(req.body);
      const expectedResults = await this.testCaseService.reorderExpectedResults(testCaseId, expectedResultIds, req.user!.id, groupId);

      res.json({ expectedResults });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケースコピー
   */
  copy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const data = copyTestCaseSchema.parse(req.body);
      const testCase = await this.testCaseService.copy(testCaseId, req.user!.id, data);

      res.status(201).json({ testCase });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 履歴取得（グループ化版）
   * グループ単位でのページネーションを行い、ページ境界をまたぐグループの分断を防ぐ
   */
  getHistories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const { limit, offset } = paginationQuerySchema.parse(req.query);
      const result = await this.testCaseService.getHistoriesGrouped(testCaseId, { limit, offset });

      res.json({
        items: result.items,
        totalGroups: result.totalGroups,
        total: result.totalHistories,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケース復元
   */
  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testCaseId } = req.params;
      const testCase = await this.testCaseService.restore(testCaseId, req.user!.id);

      res.json({ testCase });
    } catch (error) {
      next(error);
    }
  };
}
