import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectEnvironmentCreateSchema,
  projectEnvironmentUpdateSchema,
  projectEnvironmentReorderSchema,
} from '@agentest/shared';
import { ProjectService } from '../services/project.service.js';

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'WRITE', 'READ']).default('READ'),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'WRITE', 'READ']),
});

/**
 * プロジェクトコントローラー
 */
export class ProjectController {
  private projectService = new ProjectService();

  /**
   * プロジェクト作成
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = projectCreateSchema.parse(req.body);
      const project = await this.projectService.create(req.user!.id, data);

      res.status(201).json({ project });
    } catch (error) {
      next(error);
    }
  };

  /**
   * プロジェクト詳細取得
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const project = await this.projectService.findById(projectId);

      res.json({ project });
    } catch (error) {
      next(error);
    }
  };

  /**
   * プロジェクト更新
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const data = projectUpdateSchema.parse(req.body);
      const project = await this.projectService.update(projectId, data, req.user!.id);

      res.json({ project });
    } catch (error) {
      next(error);
    }
  };

  /**
   * プロジェクト削除
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      await this.projectService.softDelete(projectId, req.user!.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * メンバー一覧取得
   */
  getMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const members = await this.projectService.getMembers(projectId);

      res.json({ members });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メンバー追加
   */
  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const data = addMemberSchema.parse(req.body);
      const member = await this.projectService.addMember(projectId, data.userId, data.role);

      res.status(201).json({ member });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メンバーロール更新
   */
  updateMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, userId } = req.params;
      const data = updateMemberRoleSchema.parse(req.body);
      const member = await this.projectService.updateMemberRole(projectId, userId, data.role);

      res.json({ member });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メンバー削除
   */
  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, userId } = req.params;
      await this.projectService.removeMember(projectId, userId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 環境一覧取得
   */
  getEnvironments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const environments = await this.projectService.getEnvironments(projectId);

      res.json({ environments });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 環境作成
   */
  createEnvironment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const data = projectEnvironmentCreateSchema.parse(req.body);
      const environment = await this.projectService.createEnvironment(projectId, data);

      res.status(201).json({ environment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 環境更新
   */
  updateEnvironment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, environmentId } = req.params;
      const data = projectEnvironmentUpdateSchema.parse(req.body);
      const environment = await this.projectService.updateEnvironment(projectId, environmentId, data);

      res.json({ environment });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 環境削除
   */
  deleteEnvironment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId, environmentId } = req.params;
      await this.projectService.deleteEnvironment(projectId, environmentId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 環境並替
   */
  reorderEnvironments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const data = projectEnvironmentReorderSchema.parse(req.body);
      const environments = await this.projectService.reorderEnvironments(projectId, data.environmentIds);

      res.json({ environments });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイート一覧取得
   */
  getTestSuites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const testSuites = await this.projectService.getTestSuites(projectId);

      res.json({ testSuites });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 履歴一覧取得
   */
  getHistories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const histories = await this.projectService.getHistories(projectId, { limit, offset });

      res.json({ histories });
    } catch (error) {
      next(error);
    }
  };

  /**
   * プロジェクト復元
   */
  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const project = await this.projectService.restore(projectId, req.user!.id);

      res.json({ project });
    } catch (error) {
      next(error);
    }
  };
}
