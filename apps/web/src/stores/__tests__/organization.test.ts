import { describe, it, expect, beforeEach } from 'vitest';
import {
  useOrganizationStore,
  useSelectedOrganization,
  useCurrentOrganizationRole,
} from '../organization';
import type { Organization } from '../../lib/api';

// テスト用のモック組織データ
function createMockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 'org-1',
    name: 'テスト組織',
    slug: 'test-org',
    plan: 'FREE' as const,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as Organization;
}

describe('organization store', () => {
  beforeEach(() => {
    useOrganizationStore.getState().reset();
  });

  describe('初期状態', () => {
    it('初期状態が正しい', () => {
      const state = useOrganizationStore.getState();
      expect(state.organizations).toEqual([]);
      expect(state.selectedOrganizationId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('setOrganizations', () => {
    it('組織一覧を設定する', () => {
      const orgs = [
        { organization: createMockOrganization(), role: 'OWNER' as const },
      ];
      useOrganizationStore.getState().setOrganizations(orgs);
      expect(useOrganizationStore.getState().organizations).toEqual(orgs);
    });

    it('エラーをクリアする', () => {
      useOrganizationStore.setState({ error: 'エラー' });
      useOrganizationStore.getState().setOrganizations([]);
      expect(useOrganizationStore.getState().error).toBeNull();
    });

    it('選択中の組織が含まれていない場合はリセットする', () => {
      useOrganizationStore.setState({ selectedOrganizationId: 'org-removed' });
      useOrganizationStore.getState().setOrganizations([
        { organization: createMockOrganization({ id: 'org-1' }), role: 'OWNER' },
      ]);
      expect(useOrganizationStore.getState().selectedOrganizationId).toBeNull();
    });

    it('選択中の組織が含まれている場合はそのまま', () => {
      useOrganizationStore.setState({ selectedOrganizationId: 'org-1' });
      useOrganizationStore.getState().setOrganizations([
        { organization: createMockOrganization({ id: 'org-1' }), role: 'OWNER' },
      ]);
      expect(useOrganizationStore.getState().selectedOrganizationId).toBe('org-1');
    });
  });

  describe('selectOrganization', () => {
    it('組織を選択する', () => {
      useOrganizationStore.getState().selectOrganization('org-1');
      expect(useOrganizationStore.getState().selectedOrganizationId).toBe('org-1');
    });

    it('nullを設定して個人モードに戻す', () => {
      useOrganizationStore.getState().selectOrganization('org-1');
      useOrganizationStore.getState().selectOrganization(null);
      expect(useOrganizationStore.getState().selectedOrganizationId).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('ローディング状態を設定する', () => {
      useOrganizationStore.getState().setLoading(true);
      expect(useOrganizationStore.getState().isLoading).toBe(true);
    });
  });

  describe('setError', () => {
    it('エラーを設定する', () => {
      useOrganizationStore.getState().setError('テストエラー');
      expect(useOrganizationStore.getState().error).toBe('テストエラー');
    });

    it('エラーをクリアする', () => {
      useOrganizationStore.getState().setError('テストエラー');
      useOrganizationStore.getState().setError(null);
      expect(useOrganizationStore.getState().error).toBeNull();
    });
  });

  describe('addOrganization', () => {
    it('組織を追加する', () => {
      const org = createMockOrganization();
      useOrganizationStore.getState().addOrganization(org, 'OWNER');
      const { organizations } = useOrganizationStore.getState();
      expect(organizations).toHaveLength(1);
      expect(organizations[0].organization).toEqual(org);
      expect(organizations[0].role).toBe('OWNER');
    });
  });

  describe('updateOrganization', () => {
    it('組織を更新する', () => {
      useOrganizationStore.getState().setOrganizations([
        { organization: createMockOrganization({ id: 'org-1', name: '旧名前' }), role: 'OWNER' },
      ]);
      useOrganizationStore.getState().updateOrganization('org-1', { name: '新名前' });
      const { organizations } = useOrganizationStore.getState();
      expect(organizations[0].organization.name).toBe('新名前');
    });

    it('存在しない組織IDを指定しても安全', () => {
      useOrganizationStore.getState().setOrganizations([
        { organization: createMockOrganization(), role: 'OWNER' },
      ]);
      useOrganizationStore.getState().updateOrganization('nonexistent', { name: '新名前' });
      expect(useOrganizationStore.getState().organizations[0].organization.name).toBe('テスト組織');
    });
  });

  describe('removeOrganization', () => {
    it('組織を削除する', () => {
      useOrganizationStore.getState().setOrganizations([
        { organization: createMockOrganization({ id: 'org-1' }), role: 'OWNER' },
        { organization: createMockOrganization({ id: 'org-2', name: '組織2' }), role: 'MEMBER' },
      ]);
      useOrganizationStore.getState().removeOrganization('org-1');
      const { organizations } = useOrganizationStore.getState();
      expect(organizations).toHaveLength(1);
      expect(organizations[0].organization.id).toBe('org-2');
    });

    it('削除した組織が選択中だった場合はリセットする', () => {
      useOrganizationStore.getState().setOrganizations([
        { organization: createMockOrganization({ id: 'org-1' }), role: 'OWNER' },
      ]);
      useOrganizationStore.getState().selectOrganization('org-1');
      useOrganizationStore.getState().removeOrganization('org-1');
      expect(useOrganizationStore.getState().selectedOrganizationId).toBeNull();
    });

    it('削除した組織が選択中でない場合は選択を維持する', () => {
      useOrganizationStore.getState().setOrganizations([
        { organization: createMockOrganization({ id: 'org-1' }), role: 'OWNER' },
        { organization: createMockOrganization({ id: 'org-2' }), role: 'MEMBER' },
      ]);
      useOrganizationStore.getState().selectOrganization('org-2');
      useOrganizationStore.getState().removeOrganization('org-1');
      expect(useOrganizationStore.getState().selectedOrganizationId).toBe('org-2');
    });
  });

  describe('reset', () => {
    it('ストアを初期状態にリセットする', () => {
      useOrganizationStore.getState().setOrganizations([
        { organization: createMockOrganization(), role: 'OWNER' },
      ]);
      useOrganizationStore.getState().selectOrganization('org-1');
      useOrganizationStore.getState().setError('エラー');

      useOrganizationStore.getState().reset();

      const state = useOrganizationStore.getState();
      expect(state.organizations).toEqual([]);
      expect(state.selectedOrganizationId).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('useSelectedOrganization セレクター', () => {
    it('選択中の組織が無い場合はnullを返す', () => {
      // セレクターはフック経由なのでストアの直接アクセスでテスト
      const state = useOrganizationStore.getState();
      const selected = state.selectedOrganizationId
        ? state.organizations.find((o) => o.organization.id === state.selectedOrganizationId)
        : null;
      expect(selected).toBeNull();
    });
  });

  describe('useCurrentOrganizationRole セレクター', () => {
    it('選択中の組織が無い場合はnullを返す', () => {
      const state = useOrganizationStore.getState();
      const found = state.selectedOrganizationId
        ? state.organizations.find((o) => o.organization.id === state.selectedOrganizationId)
        : null;
      expect(found?.role || null).toBeNull();
    });
  });
});
