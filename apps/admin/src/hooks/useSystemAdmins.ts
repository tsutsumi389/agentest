import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SystemAdminSearchParams,
  SystemAdminInviteRequest,
  SystemAdminUpdateRequest,
} from '@agentest/shared/types';
import { systemAdminApi } from '../lib/api';

/**
 * システム管理者一覧を取得するフック
 */
export function useSystemAdmins(params: SystemAdminSearchParams = {}) {
  return useQuery({
    queryKey: ['system-admins', params],
    queryFn: () => systemAdminApi.list(params),
    staleTime: 60 * 1000, // 1分間はキャッシュを使用
  });
}

/**
 * システム管理者詳細を取得するフック
 */
export function useSystemAdmin(adminUserId: string) {
  return useQuery({
    queryKey: ['system-admin', adminUserId],
    queryFn: () => systemAdminApi.getById(adminUserId),
    enabled: !!adminUserId,
    staleTime: 30 * 1000, // 30秒間はキャッシュを使用
  });
}

/**
 * システム管理者を招待するミューテーションフック
 */
export function useInviteSystemAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SystemAdminInviteRequest) => systemAdminApi.invite(data),
    onSuccess: () => {
      // 一覧キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['system-admins'] });
    },
  });
}

/**
 * システム管理者を更新するミューテーションフック
 */
export function useUpdateSystemAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adminUserId, data }: { adminUserId: string; data: SystemAdminUpdateRequest }) =>
      systemAdminApi.update(adminUserId, data),
    onSuccess: (_, variables) => {
      // 一覧と詳細キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['system-admins'] });
      queryClient.invalidateQueries({ queryKey: ['system-admin', variables.adminUserId] });
    },
  });
}

/**
 * システム管理者を削除するミューテーションフック
 */
export function useDeleteSystemAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adminUserId: string) => systemAdminApi.delete(adminUserId),
    onSuccess: (_, adminUserId) => {
      // 一覧と詳細キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['system-admins'] });
      queryClient.invalidateQueries({ queryKey: ['system-admin', adminUserId] });
    },
  });
}

/**
 * アカウントロックを解除するミューテーションフック
 */
export function useUnlockSystemAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adminUserId: string) => systemAdminApi.unlock(adminUserId),
    onSuccess: (_, adminUserId) => {
      // 一覧と詳細キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['system-admins'] });
      queryClient.invalidateQueries({ queryKey: ['system-admin', adminUserId] });
    },
  });
}

/**
 * 2FAをリセットするミューテーションフック
 */
export function useReset2FASystemAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adminUserId: string) => systemAdminApi.reset2FA(adminUserId),
    onSuccess: (_, adminUserId) => {
      // 詳細キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['system-admin', adminUserId] });
    },
  });
}
