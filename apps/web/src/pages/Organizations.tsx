import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, Plus, Search } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { OrganizationCard, CreateOrganizationModal } from '../components/organization';

/**
 * 組織一覧ページ
 */
export function OrganizationsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { organizations, isLoading, selectOrganization } = useOrganization();

  // 検索フィルター
  const filteredOrganizations = organizations.filter((org) =>
    org.organization.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.organization.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 組織を選択してダッシュボードに移動
  const handleSelectOrganization = (organizationId: string) => {
    selectOrganization(organizationId);
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">組織</h1>
          <p className="text-foreground-muted mt-1">
            所属組織の管理
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          組織を作成
        </button>
      </div>

      {/* 検索 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" aria-hidden="true" />
        <input
          type="text"
          placeholder="組織を検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-10"
          aria-label="組織を検索"
        />
      </div>

      {/* 組織リスト */}
      {isLoading ? (
        <div className="card p-8 text-center text-foreground-muted" role="status" aria-busy="true">
          読み込み中...
        </div>
      ) : filteredOrganizations.length === 0 ? (
        <div className="card p-8 text-center">
          <Building2 className="w-12 h-12 text-foreground-subtle mx-auto mb-3" aria-hidden="true" />
          <p className="text-foreground-muted mb-4">
            {searchQuery ? '組織が見つかりません' : '所属している組織がありません'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              組織を作成
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrganizations.map(({ organization, role }) => (
            <OrganizationCard
              key={organization.id}
              organization={organization}
              role={role}
              onSelect={() => handleSelectOrganization(organization.id)}
            />
          ))}
        </div>
      )}

      {/* ヒント */}
      {organizations.length > 0 && (
        <div className="text-sm text-foreground-muted">
          <p>
            組織を選択すると、その組織のプロジェクトやテストが表示されます。
            個人のプロジェクトに戻るには、サイドメニューの組織セレクターから「個人」を選択してください。
          </p>
        </div>
      )}

      {/* 組織作成モーダル */}
      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(organizationId) => {
          // 作成した組織を選択してダッシュボードに移動
          selectOrganization(organizationId);
          navigate('/dashboard');
        }}
      />
    </div>
  );
}
