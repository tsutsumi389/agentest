import { api } from './client.js';
import type {
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  InvitationDetail,
  Project,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  InviteMemberRequest,
  AuditLogQueryParams,
  AuditLogExportParams,
  AuditLogResponse,
} from './types.js';

// ============================================
// 組織API
// ============================================

export const organizationsApi = {
  // 組織を作成
  create: (data: CreateOrganizationRequest) =>
    api.post<{ organization: Organization }>('/api/organizations', data),

  // 組織詳細を取得
  getById: (organizationId: string) =>
    api.get<{ organization: Organization }>(`/api/organizations/${organizationId}`),

  // 組織を更新
  update: (organizationId: string, data: UpdateOrganizationRequest) =>
    api.patch<{ organization: Organization }>(`/api/organizations/${organizationId}`, data),

  // 組織を削除
  delete: (organizationId: string) =>
    api.delete<void>(`/api/organizations/${organizationId}`),

  // メンバー一覧を取得
  getMembers: (organizationId: string) =>
    api.get<{ members: OrganizationMember[] }>(`/api/organizations/${organizationId}/members`),

  // メンバーを招待
  invite: (organizationId: string, data: InviteMemberRequest) =>
    api.post<{ invitation: OrganizationInvitation; emailSent: boolean }>(`/api/organizations/${organizationId}/invitations`, data),

  // 保留中の招待一覧を取得
  getInvitations: (organizationId: string) =>
    api.get<{ invitations: OrganizationInvitation[] }>(`/api/organizations/${organizationId}/invitations`),

  // 招待を取消
  cancelInvitation: (organizationId: string, invitationId: string) =>
    api.delete<void>(`/api/organizations/${organizationId}/invitations/${invitationId}`),

  // 招待詳細を取得（トークンベース、認証不要）
  getInvitationByToken: (token: string) =>
    api.get<{ invitation: InvitationDetail }>(`/api/organizations/invitations/${token}`),

  // 招待を承諾
  acceptInvitation: (token: string) =>
    api.post<{ member: OrganizationMember }>(`/api/organizations/invitations/${token}/accept`),

  // 招待を辞退
  declineInvitation: (token: string) =>
    api.post<{ invitation: OrganizationInvitation }>(`/api/organizations/invitations/${token}/decline`),

  // メンバーのロールを更新
  updateMemberRole: (organizationId: string, userId: string, role: 'ADMIN' | 'MEMBER') =>
    api.patch<{ member: OrganizationMember }>(`/api/organizations/${organizationId}/members/${userId}`, { role }),

  // メンバーを削除
  removeMember: (organizationId: string, userId: string) =>
    api.delete<void>(`/api/organizations/${organizationId}/members/${userId}`),

  // オーナー権限を移譲
  transferOwnership: (organizationId: string, newOwnerId: string) =>
    api.post<{ member: OrganizationMember }>(`/api/organizations/${organizationId}/transfer-ownership`, { newOwnerId }),

  // 監査ログを取得
  getAuditLogs: (organizationId: string, params?: AuditLogQueryParams) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.category) query.set('category', params.category);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    const queryString = query.toString();
    return api.get<AuditLogResponse>(
      `/api/organizations/${organizationId}/audit-logs${queryString ? `?${queryString}` : ''}`
    );
  },

  // 監査ログをエクスポート
  exportAuditLogs: (organizationId: string, params: AuditLogExportParams): Promise<Blob> => {
    const query = new URLSearchParams();
    query.set('format', params.format);
    if (params.category) query.set('category', params.category);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryString = query.toString();
    return api.getBlob(`/api/organizations/${organizationId}/audit-logs/export?${queryString}`);
  },

  // 組織のプロジェクト一覧を取得
  getProjects: (organizationId: string) =>
    api.get<{ projects: Project[] }>(`/api/organizations/${organizationId}/projects`),

  // 削除済み組織を復元
  restore: (organizationId: string) =>
    api.post<{ organization: Organization }>(`/api/organizations/${organizationId}/restore`),
};
