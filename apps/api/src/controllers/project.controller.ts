import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  projectCreateSchema,
  projectUpdateSchema,
  projectEnvironmentCreateSchema,
  projectEnvironmentUpdateSchema,
  projectEnvironmentReorderSchema,
  testSuiteSearchSchema,
  suggestionSearchSchema,
} from '@agentest/shared';
import { ProjectService } from '../services/project.service.js';
import { ProjectDashboardService } from '../services/project-dashboard.service.js';
import type { TestSuiteSearchItem, JudgmentCounts } from '../repositories/test-suite.repository.js';

/**
 * 期待結果のステータスを集計して判定カウントを返す
 */
function countJudgmentStatuses(
  expectedResults: Array<{ status: string }>
): JudgmentCounts {
  const counts: JudgmentCounts = {
    PASS: 0,
    FAIL: 0,
    PENDING: 0,
    SKIPPED: 0,
  };

  for (const result of expectedResults) {
    if (result.status in counts) {
      counts[result.status as keyof JudgmentCounts]++;
    }
  }

  return counts;
}

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
  private dashboardService = new ProjectDashboardService();

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
      const member = await this.projectService.addMember(projectId, data.userId, data.role, req.user!.id);

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
   * テストスイート一覧取得・検索
   */
  getTestSuites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;

      // クエリパラメータをパース
      const searchParams = testSuiteSearchSchema.parse(req.query);

      // 検索実行
      const { items, total } = await this.projectService.searchTestSuites(projectId, searchParams);

      // レスポンス用に整形（ラベルと最終実行情報をフラット化）
      const testSuites = (items as TestSuiteSearchItem[]).map((item) => {
        // testSuiteLabelsからlabels配列に変換
        const labels = item.testSuiteLabels.map((tsl) => tsl.label);
        // executions配列から最初の要素をlastExecutionとして取得し、judgmentCountsを計算
        const rawExecution = item.executions[0];
        const lastExecution = rawExecution
          ? {
              id: rawExecution.id,
              createdAt: rawExecution.createdAt,
              environment: rawExecution.environment ?? null,
              judgmentCounts: countJudgmentStatuses(rawExecution.expectedResults),
            }
          : null;

        // 不要なプロパティを除外してレスポンスを構築
        const { testSuiteLabels: _testSuiteLabels, executions: _executions, ...rest } = item;

        return {
          ...rest,
          labels,
          lastExecution,
        };
      });

      res.json({
        testSuites,
        total,
        limit: searchParams.limit,
        offset: searchParams.offset,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * テストスイートサジェスト取得（@メンション用）
   */
  suggestTestSuites = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;
      const searchParams = suggestionSearchSchema.parse(req.query);
      const suggestions = await this.projectService.suggestTestSuites(projectId, searchParams);

      res.json({ suggestions });
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

      // クエリパラメータのバリデーション
      const limitParam = req.query.limit;
      const offsetParam = req.query.offset;
      let limit: number | undefined;
      let offset: number | undefined;

      if (limitParam !== undefined) {
        const parsed = Number(limitParam);
        if (isNaN(parsed) || parsed < 1 || parsed > 100) {
          res.status(400).json({ error: 'limit は 1〜100 の整数である必要があります' });
          return;
        }
        limit = parsed;
      }

      if (offsetParam !== undefined) {
        const parsed = Number(offsetParam);
        if (isNaN(parsed) || parsed < 0) {
          res.status(400).json({ error: 'offset は 0 以上の整数である必要があります' });
          return;
        }
        offset = parsed;
      }

      const { histories, total } = await this.projectService.getHistories(projectId, { limit, offset });

      res.json({ histories, total });
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

  /**
   * プロジェクトダッシュボード統計取得
   */
  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { projectId } = req.params;

      // フィルターパラメータを取得
      const environmentId = req.query.environmentId as string | undefined;
      const labelIdsParam = req.query.labelIds as string | undefined;
      const labelIds = labelIdsParam ? labelIdsParam.split(',').filter(Boolean) : undefined;

      const filters = environmentId || labelIds
        ? { environmentId, labelIds }
        : undefined;

      const dashboard = await this.dashboardService.getDashboard(projectId, filters);

      res.json({ dashboard });
    } catch (error) {
      next(error);
    }
  };
}
