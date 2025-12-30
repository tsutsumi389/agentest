import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExecutionService } from '../services/execution.service.js';

const updatePreconditionResultSchema = z.object({
  status: z.enum(['UNCHECKED', 'MET', 'NOT_MET']),
  note: z.string().max(2000).optional(),
});

const updateStepResultSchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'SKIPPED']),
  note: z.string().max(2000).optional(),
});

const updateExpectedResultSchema = z.object({
  status: z.enum(['PENDING', 'PASS', 'FAIL', 'SKIPPED', 'NOT_EXECUTABLE']),
  note: z.string().max(2000).optional(),
});

/**
 * 実行コントローラー
 */
export class ExecutionController {
  private executionService = new ExecutionService();

  /**
   * 実行詳細取得（軽量版）
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId } = req.params;
      const execution = await this.executionService.findById(executionId);

      res.json({ execution });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 実行詳細取得（スナップショット、全結果データ含む）
   */
  getByIdWithDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId } = req.params;
      const execution = await this.executionService.findByIdWithDetails(executionId);

      res.json({ execution });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 実行中止
   */
  abort = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId } = req.params;
      const execution = await this.executionService.abort(executionId);

      res.json({ execution });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 実行完了
   */
  complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId } = req.params;
      const execution = await this.executionService.complete(executionId);

      res.json({ execution });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 前提条件結果更新
   */
  updatePreconditionResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId, preconditionResultId } = req.params;
      const data = updatePreconditionResultSchema.parse(req.body);
      const result = await this.executionService.updatePreconditionResult(
        executionId,
        preconditionResultId,
        data
      );

      res.json({ result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ステップ結果更新
   */
  updateStepResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId, stepResultId } = req.params;
      const data = updateStepResultSchema.parse(req.body);
      const result = await this.executionService.updateStepResult(
        executionId,
        stepResultId,
        data
      );

      res.json({ result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 期待結果更新
   */
  updateExpectedResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId, expectedResultId } = req.params;
      const data = updateExpectedResultSchema.parse(req.body);
      const result = await this.executionService.updateExpectedResult(
        executionId,
        expectedResultId,
        data
      );

      res.json({ result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * エビデンスアップロード
   */
  uploadEvidence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId, expectedResultId } = req.params;
      const evidence = await this.executionService.uploadEvidence(
        executionId,
        expectedResultId,
        req.user!.id,
        req.body
      );

      res.status(201).json({ evidence });
    } catch (error) {
      next(error);
    }
  };
}
