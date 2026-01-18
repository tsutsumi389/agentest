import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { BadRequestError } from '@agentest/shared';
import { ExecutionService } from '../services/execution.service.js';
import { evidenceUpload } from '../config/upload.js';

const updatePreconditionResultSchema = z.object({
  status: z.enum(['UNCHECKED', 'MET', 'NOT_MET']),
  note: z.string().max(2000).optional(),
});

const updateStepResultSchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'SKIPPED']),
  note: z.string().max(2000).optional(),
});

const updateExpectedResultSchema = z.object({
  status: z.enum(['PENDING', 'PASS', 'FAIL', 'SKIPPED']),
  note: z.string().max(2000).optional(),
});

/**
 * 実行コントローラー
 */
export class ExecutionController {
  private executionService = new ExecutionService();

  /**
   * エビデンスアップロード用multerミドルウェア
   */
  static evidenceUploadMiddleware: RequestHandler = evidenceUpload.single('file');

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
        data,
        { userId: req.user!.id }
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
        data,
        { userId: req.user!.id }
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
        data,
        { userId: req.user!.id }
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

      if (!req.file) {
        throw new BadRequestError('ファイルが指定されていません');
      }

      const evidence = await this.executionService.uploadEvidence(
        executionId,
        expectedResultId,
        req.user!.id,
        req.file,
        req.body.description
      );

      // BigIntをnumberに変換してレスポンス
      res.status(201).json({
        evidence: {
          ...evidence,
          fileSize: Number(evidence.fileSize),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * エビデンス削除
   */
  deleteEvidence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId, evidenceId } = req.params;
      await this.executionService.deleteEvidence(executionId, evidenceId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * エビデンスダウンロードURL取得
   */
  getEvidenceDownloadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { executionId, evidenceId } = req.params;
      const downloadUrl = await this.executionService.getEvidenceDownloadUrl(executionId, evidenceId);

      res.json({ downloadUrl });
    } catch (error) {
      next(error);
    }
  };
}
