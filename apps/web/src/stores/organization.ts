import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization } from '../lib/api';

/**
 * 組織ストアの状態
 */
interface OrganizationState {
  // 所属組織一覧
  organizations: Array<{
    organization: Organization;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
  }>;
  // 現在選択中の組織ID（nullの場合は個人モード）
  selectedOrganizationId: string | null;
  // 読み込み中フラグ
  isLoading: boolean;
  // エラー
  error: string | null;
}

/**
 * 組織ストアのアクション
 */
interface OrganizationActions {
  // 組織一覧を設定
  setOrganizations: (
    organizations: Array<{ organization: Organization; role: 'OWNER' | 'ADMIN' | 'MEMBER' }>
  ) => void;
  // 組織を選択
  selectOrganization: (organizationId: string | null) => void;
  // 読み込み状態を設定
  setLoading: (isLoading: boolean) => void;
  // エラーを設定
  setError: (error: string | null) => void;
  // 組織を追加
  addOrganization: (organization: Organization, role: 'OWNER' | 'ADMIN' | 'MEMBER') => void;
  // 組織を更新
  updateOrganization: (organizationId: string, updates: Partial<Organization>) => void;
  // 組織を削除
  removeOrganization: (organizationId: string) => void;
  // ストアをリセット
  reset: () => void;
}

const initialState: OrganizationState = {
  organizations: [],
  selectedOrganizationId: null,
  isLoading: false,
  error: null,
};

/**
 * 組織ストア
 *
 * ユーザーの所属組織と現在選択中の組織を管理
 */
export const useOrganizationStore = create<OrganizationState & OrganizationActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setOrganizations: (organizations) => {
        set({ organizations, error: null });

        // 選択中の組織が所属組織に含まれていない場合はリセット
        const { selectedOrganizationId } = get();
        if (selectedOrganizationId) {
          const exists = organizations.some(
            (o) => o.organization.id === selectedOrganizationId
          );
          if (!exists) {
            set({ selectedOrganizationId: null });
          }
        }
      },

      selectOrganization: (organizationId) => {
        set({ selectedOrganizationId: organizationId });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },

      addOrganization: (organization, role) => {
        set((state) => ({
          organizations: [...state.organizations, { organization, role }],
        }));
      },

      updateOrganization: (organizationId, updates) => {
        set((state) => ({
          organizations: state.organizations.map((o) =>
            o.organization.id === organizationId
              ? { ...o, organization: { ...o.organization, ...updates } }
              : o
          ),
        }));
      },

      removeOrganization: (organizationId) => {
        set((state) => {
          const newOrganizations = state.organizations.filter(
            (o) => o.organization.id !== organizationId
          );
          return {
            organizations: newOrganizations,
            // 削除した組織が選択中だった場合はリセット
            selectedOrganizationId:
              state.selectedOrganizationId === organizationId
                ? null
                : state.selectedOrganizationId,
          };
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'organization-storage',
      // selectedOrganizationIdのみ永続化
      partialize: (state) => ({
        selectedOrganizationId: state.selectedOrganizationId,
      }),
    }
  )
);

/**
 * 現在選択中の組織を取得するセレクター
 */
export const useSelectedOrganization = () => {
  return useOrganizationStore((state) => {
    if (!state.selectedOrganizationId) return null;
    const found = state.organizations.find(
      (o) => o.organization.id === state.selectedOrganizationId
    );
    return found || null;
  });
};

/**
 * 現在選択中の組織でのロールを取得するセレクター
 */
export const useCurrentOrganizationRole = () => {
  return useOrganizationStore((state) => {
    if (!state.selectedOrganizationId) return null;
    const found = state.organizations.find(
      (o) => o.organization.id === state.selectedOrganizationId
    );
    return found?.role || null;
  });
};
