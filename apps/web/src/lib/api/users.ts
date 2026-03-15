import { api } from './client.js';
import type {
  User,
  Organization,
  UpdateUserRequest,
  GetProjectsOptions,
  ProjectWithRole,
} from './types.js';
import type { RecentExecutionItem } from '@agentest/shared';

// ============================================
// ユーザーAPI
// ============================================

export const usersApi = {
  getOrganizations: (userId: string, options?: { includeDeleted?: boolean }) => {
    const query = new URLSearchParams();
    if (options?.includeDeleted) query.set('includeDeleted', 'true');
    const queryString = query.toString();
    return api.get<{ organizations: Array<{ organization: Organization; role: string }> }>(
      `/api/users/${userId}/organizations${queryString ? `?${queryString}` : ''}`
    );
  },
  getProjects: (userId: string, options?: GetProjectsOptions) => {
    const query = new URLSearchParams();
    if (options?.q) query.set('q', options.q);
    // organizationIdがnullの場合は個人プロジェクトのみ、undefinedの場合はフィルタなし
    if (options?.organizationId !== undefined) {
      query.set(
        'organizationId',
        options.organizationId === null ? 'personal' : options.organizationId
      );
    }
    if (options?.includeDeleted) query.set('includeDeleted', 'true');
    if (options?.limit) query.set('limit', String(options.limit));
    if (options?.offset) query.set('offset', String(options.offset));
    const queryString = query.toString();
    return api.get<{ projects: ProjectWithRole[] }>(
      `/api/users/${userId}/projects${queryString ? `?${queryString}` : ''}`
    );
  },
  getRecentExecutions: (userId: string, options?: { limit?: number }) => {
    const query = new URLSearchParams();
    if (options?.limit) query.set('limit', String(options.limit));
    const queryString = query.toString();
    return api.get<{ executions: RecentExecutionItem[] }>(
      `/api/users/${userId}/recent-executions${queryString ? `?${queryString}` : ''}`
    );
  },
  update: (userId: string, data: UpdateUserRequest) =>
    api.patch<{ user: User }>(`/api/users/${userId}`, data),
};
