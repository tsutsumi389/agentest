import type { Request, Response, NextFunction } from 'express';
import { labelCreateSchema, labelUpdateSchema, testSuiteLabelsUpdateSchema } from '@agentest/shared';
import { LabelService } from '../services/label.service.js';

/**
 * ラベルコントローラー
 */
export class LabelController {
  private labelService = new LabelService();

  /**
   * ラベル一覧取得
   */
  getLabels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const labels = await this.labelService.getByProjectId(projectId);

      res.json({ labels });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ラベル作成
   */
  createLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const data = labelCreateSchema.parse(req.body);
      const label = await this.labelService.create(projectId, data);

      res.status(201).json({ label });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ラベル更新
   */
  updateLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, labelId } = req.params;
      const data = labelUpdateSchema.parse(req.body);
      const label = await this.labelService.update(projectId, labelId, data);

      res.json({ label });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ラベル削除
   */
  deleteLabel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, labelId } = req.params;
      await this.labelService.delete(projectId, labelId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイートのラベル一覧取得
   */
  getTestSuiteLabels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const labels = await this.labelService.getTestSuiteLabels(testSuiteId);

      res.json({ labels });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイートのラベル一括更新
   */
  updateTestSuiteLabels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testSuiteId } = req.params;
      const { labelIds } = testSuiteLabelsUpdateSchema.parse(req.body);
      const labels = await this.labelService.updateTestSuiteLabels(testSuiteId, labelIds);

      res.json({ labels });
    } catch (error) {
      next(error);
    }
  };
}
