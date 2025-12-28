import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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
});

const addPreconditionSchema = z.object({
  content: z.string().min(1).max(2000),
  orderKey: z.string().optional(),
});

const updatePreconditionSchema = z.object({
  content: z.string().min(1).max(2000),
});

const preconditionIdParamSchema = z.object({
  preconditionId: z.string().uuid(),
});

const reorderPreconditionsSchema = z.object({
  preconditionIds: z.array(z.string().uuid()),
});

const startExecutionSchema = z.object({
  environmentId: z.string().uuid().optional(),
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
      const data = updateTestSuiteSchema.parse(req.body);
      const testSuite = await this.testSuiteService.update(testSuiteId, req.user!.id, data);

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
   * テストケース一覧取得
   */
  getTestCases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const testCases = await this.testSuiteService.getTestCases(testSuiteId);

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
      const data = addPreconditionSchema.parse(req.body);
      const precondition = await this.testSuiteService.addPrecondition(testSuiteId, req.user!.id, data);

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
      const data = updatePreconditionSchema.parse(req.body);
      const precondition = await this.testSuiteService.updatePrecondition(testSuiteId, preconditionId, req.user!.id, data);

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
      await this.testSuiteService.deletePrecondition(testSuiteId, preconditionId, req.user!.id);

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
      const { preconditionIds } = reorderPreconditionsSchema.parse(req.body);
      const preconditions = await this.testSuiteService.reorderPreconditions(testSuiteId, preconditionIds, req.user!.id);

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
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const executions = await this.testSuiteService.getExecutions(testSuiteId, { limit, offset });

      res.json({ executions });
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
}
