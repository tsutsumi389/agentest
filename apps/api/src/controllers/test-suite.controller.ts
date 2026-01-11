import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  testCaseSearchSchema,
  executionSearchSchema,
  suggestionSearchSchema,
} from '@agentest/shared';
import { TestSuiteService } from '../services/test-suite.service.js';

const createTestSuiteSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

const updateTestSuiteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  groupId: z.string().uuid().optional(),
});

const addPreconditionSchema = z.object({
  content: z.string().min(1).max(2000),
  orderKey: z.string().optional(),
  groupId: z.string().uuid().optional(),
});

const updatePreconditionSchema = z.object({
  content: z.string().min(1).max(2000),
  groupId: z.string().uuid().optional(),
});

const preconditionIdParamSchema = z.object({
  preconditionId: z.string().uuid(),
});

const reorderPreconditionsSchema = z.object({
  preconditionIds: z.array(z.string().uuid()),
  groupId: z.string().uuid().optional(),
});

const reorderTestCasesSchema = z.object({
  testCaseIds: z.array(z.string().uuid()).min(1),
  groupId: z.string().uuid().optional(),
});

const deletePreconditionBodySchema = z.object({
  groupId: z.string().uuid().optional(),
}).optional().default({});

const startExecutionSchema = z.object({
  environmentId: z.string().uuid().optional(),
});

const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * テストスイートコントローラー
 */
export class TestSuiteController {
  private testSuiteService = new TestSuiteService();

  /**
   * テストスイート作成
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createTestSuiteSchema.parse(req.body);
      const testSuite = await this.testSuiteService.create(req.user!.id, data);

      res.status(201).json({ testSuite });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイート詳細取得
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const testSuite = await this.testSuiteService.findById(testSuiteId);

      res.json({ testSuite });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイート更新
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const { groupId, ...data } = updateTestSuiteSchema.parse(req.body);
      const testSuite = await this.testSuiteService.update(testSuiteId, req.user!.id, data, { groupId });

      res.json({ testSuite });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイート削除
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      await this.testSuiteService.softDelete(testSuiteId, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケース一覧取得（検索・フィルタ・ソート対応）
   */
  getTestCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const searchParams = testCaseSearchSchema.parse(req.query);
      const { items, total } = await this.testSuiteService.searchTestCases(testSuiteId, searchParams);

      res.json({
        testCases: items,
        total,
        limit: searchParams.limit,
        offset: searchParams.offset,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケースサジェスト取得（@メンション用）
   */
  suggestTestCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const searchParams = suggestionSearchSchema.parse(req.query);
      const suggestions = await this.testSuiteService.suggestTestCases(testSuiteId, searchParams);

      res.json({ suggestions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストケース並び替え
   */
  reorderTestCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const { testCaseIds, groupId } = reorderTestCasesSchema.parse(req.body);
      const testCases = await this.testSuiteService.reorderTestCases(testSuiteId, testCaseIds, req.user!.id, { groupId });

      res.json({ testCases });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 前提条件一覧取得
   */
  getPreconditions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const preconditions = await this.testSuiteService.getPreconditions(testSuiteId);

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
      const { testSuiteId } = req.params;
      const { groupId, ...data } = addPreconditionSchema.parse(req.body);
      const precondition = await this.testSuiteService.addPrecondition(testSuiteId, req.user!.id, data, { groupId });

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
      const { testSuiteId } = req.params;
      const { preconditionId } = preconditionIdParamSchema.parse(req.params);
      const { groupId, ...data } = updatePreconditionSchema.parse(req.body);
      const precondition = await this.testSuiteService.updatePrecondition(testSuiteId, preconditionId, req.user!.id, data, { groupId });

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
      const { testSuiteId } = req.params;
      const { preconditionId } = preconditionIdParamSchema.parse(req.params);
      const { groupId } = deletePreconditionBodySchema.parse(req.body);
      await this.testSuiteService.deletePrecondition(testSuiteId, preconditionId, req.user!.id, { groupId });

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
      const { testSuiteId } = req.params;
      const { preconditionIds, groupId } = reorderPreconditionsSchema.parse(req.body);
      const preconditions = await this.testSuiteService.reorderPreconditions(testSuiteId, preconditionIds, req.user!.id, { groupId });

      res.json({ preconditions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 実行履歴取得
   */
  getExecutions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const params = executionSearchSchema.parse(req.query);
      const { executions, total } = await this.testSuiteService.getExecutions(testSuiteId, params);

      res.json({ executions, total, limit: params.limit, offset: params.offset });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テスト実行開始
   */
  startExecution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const data = startExecutionSchema.parse(req.body);
      const execution = await this.testSuiteService.startExecution(testSuiteId, req.user!.id, data);

      res.status(201).json({ execution });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 変更履歴一覧取得（グループ化版）
   */
  getHistories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const { limit, offset } = paginationQuerySchema.parse(req.query);
      const { items, totalGroups, total } = await this.testSuiteService.getHistories(testSuiteId, { limit, offset });

      res.json({ items, totalGroups, total });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイート復元
   */
  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const testSuite = await this.testSuiteService.restore(testSuiteId, req.user!.id);

      res.json({ testSuite });
    } catch (error) {
      next(error);
    }
  };
}
