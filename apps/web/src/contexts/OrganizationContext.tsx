import { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usersApi, type Organization } from '../lib/api';
import {
  useOrganizationStore,
  useSelectedOrganization,
  useCurrentOrganizationRole,
} from '../stores/organization';

/**
 * 組織コンテキストの値
 */
interface OrganizationContextValue {
  // 所属組織一覧
  organizations: Array<{
    organization: Organization;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
  }>;
  // 現在選択中の組織（nullの場合は個人モード）
  selectedOrganization: {
    organization: Organization;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
  } | null;
  // 現在の組織でのロール
  currentRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  // 読み込み中フラグ
  isLoading: boolean;
  // エラー
  error: string | null;
  // 組織を選択
  selectOrganization: (organizationId: string | null) => void;
  // 組織一覧を再読み込み
  refreshOrganizations: () => Promise<void>;
  // 個人モードかどうか
  isPersonalMode: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/**
 * 組織コンテキストプロバイダー
 *
 * ユーザーの所属組織を取得し、組織選択状態を管理
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    organizations,
    isLoading,
    error,
    setOrganizations,
    selectOrganization,
    setLoading,
    setError,
    reset,
  } = useOrganizationStore();

  const selectedOrganization = useSelectedOrganization();
  const currentRole = useCurrentOrganizationRole();

  // ユーザーIDを取得（オブジェクト参照ではなくプリミティブ値で依存関係を管理）
  const userId = user?.id;

  // 組織一覧を取得
  const refreshOrganizations = useCallback(async () => {
    if (!userId) {
      reset();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 削除済み組織も含めて取得（復元機能のため）
      const response = await usersApi.getOrganizations(userId, { includeDeleted: true });
      setOrganizations(
        response.organizations.map((o) => ({
          organization: o.organization,
          role: o.role as 'OWNER' | 'ADMIN' | 'MEMBER',
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '組織一覧の取得に失敗しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId, setOrganizations, setLoading, setError, reset]);

  // ユーザーがログインしたら組織一覧を取得
  useEffect(() => {
    if (userId) {
      refreshOrganizations();
    } else {
      reset();
    }
  }, [userId, refreshOrganizations, reset]);

  const value: OrganizationContextValue = {
    organizations,
    selectedOrganization,
    currentRole,
    isLoading,
    error,
    selectOrganization,
    refreshOrganizations,
    isPersonalMode: selectedOrganization === null,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

/**
 * 組織コンテキストを使用するフック
 */
export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

/**
 * 現在の組織で特定の権限があるかチェックするフック
 */
export function useHasOrganizationPermission(requiredRoles: Array<'OWNER' | 'ADMIN' | 'MEMBER'>) {
  const { currentRole, isPersonalMode } = useOrganization();

  // 個人モードの場合は常にtrue
  if (isPersonalMode) {
    return true;
  }

  // 組織モードで権限チェック
  if (!currentRole) {
    return false;
  }

  return requiredRoles.includes(currentRole);
}
