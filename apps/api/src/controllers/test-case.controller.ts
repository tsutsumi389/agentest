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
});

const addPreconditionSchema = z.object({
  content: z.string().min(1).max(2000),
  orderKey: z.string().optional(),
});

const addStepSchema = z.object({
  content: z.string().min(1).max(2000),
  orderKey: z.string().optional(),
});

const addExpectedResultSchema = z.object({
  content: z.string().min(1).max(2000),
  orderKey: z.string().optional(),
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
      const data = updateTestCaseSchema.parse(req.body);
      const testCase = await this.testCaseService.update(testCaseId, req.user!.id, data);

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
      const data = addPreconditionSchema.parse(req.body);
      const precondition = await this.testCaseService.addPrecondition(testCaseId, data);

      res.status(201).json({ precondition });
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
      const data = addStepSchema.parse(req.body);
      const step = await this.testCaseService.addStep(testCaseId, data);

      res.status(201).json({ step });
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
      const data = addExpectedResultSchema.parse(req.body);
      const expectedResult = await this.testCaseService.addExpectedResult(testCaseId, data);

      res.status(201).json({ expectedResult });
    } catch (error) {
      next(error);
    }
  };
}
