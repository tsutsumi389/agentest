import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrganizationService } from '../services/organization.service.js';

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  billingEmail: z.string().email().optional().nullable(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
});

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});

/**
 * 組織コントローラー
 */
export class OrganizationController {
  private orgService = new OrganizationService();

  /**
   * 組織作成
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createOrgSchema.parse(req.body);
      const organization = await this.orgService.create(req.user!.id, data);

      res.status(201).json({ organization });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 組織詳細取得
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const organization = await this.orgService.findById(organizationId);

      res.json({ organization });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 組織更新
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const data = updateOrgSchema.parse(req.body);
      const organization = await this.orgService.update(organizationId, data);

      res.json({ organization });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 組織削除
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.params;
      await this.orgService.softDelete(organizationId);

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
      const { organizationId } = req.params;
      const members = await this.orgService.getMembers(organizationId);

      res.json({ members });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 招待送信
   */
  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const data = inviteSchema.parse(req.body);
      const invitation = await this.orgService.invite(organizationId, req.user!.id, data);

      res.status(201).json({ invitation });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 招待承認
   */
  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;
      const member = await this.orgService.acceptInvitation(token, req.user!.id);

      res.json({ member });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メンバーロール更新
   */
  updateMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, userId } = req.params;
      const data = updateMemberRoleSchema.parse(req.body);
      const member = await this.orgService.updateMemberRole(organizationId, userId, data.role);

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
      const { organizationId, userId } = req.params;
      await this.orgService.removeMember(organizationId, userId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 組織のプロジェクト一覧取得
   */
  getProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const projects = await this.orgService.getProjects(organizationId);

      res.json({ projects });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 保留中の招待一覧取得
   */
  getInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const invitations = await this.orgService.getPendingInvitations(organizationId);

      res.json({ invitations });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 招待取消
   */
  cancelInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId, invitationId } = req.params;
      await this.orgService.cancelInvitation(organizationId, invitationId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 招待辞退
   */
  declineInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;
      const invitation = await this.orgService.declineInvitation(token, req.user!.id);

      res.json({ invitation });
    } catch (error) {
      next(error);
    }
  };

  /**
   * オーナー権限移譲
   */
  transferOwnership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const data = transferOwnershipSchema.parse(req.body);
      const member = await this.orgService.transferOwnership(
        organizationId,
        req.user!.id,
        data.newOwnerId
      );

      res.json({ member });
    } catch (error) {
      next(error);
    }
  };
}
