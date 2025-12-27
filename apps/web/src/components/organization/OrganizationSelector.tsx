import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { ChevronDown, User, Building2, Plus, Settings, Check } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';

interface OrganizationSelectorProps {
  onClose?: () => void;
}

/**
 * 組織セレクター
 * 個人モードと所属組織を切り替えるドロップダウン
 */
export function OrganizationSelector({ onClose }: OrganizationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    organizations,
    selectedOrganization,
    isPersonalMode,
    selectOrganization,
    isLoading,
  } = useOrganization();

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 組織を選択
  const handleSelect = (organizationId: string | null) => {
    selectOrganization(organizationId);
    setIsOpen(false);
  };

  // 現在の選択を表示
  const currentLabel = isPersonalMode
    ? '個人'
    : selectedOrganization?.organization.name || '組織を選択';

  const currentIcon = isPersonalMode ? User : Building2;
  const CurrentIcon = currentIcon;

  return (
    <div ref={dropdownRef} className="relative">
      {/* トリガーボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm font-medium rounded-lg bg-background-tertiary hover:bg-background border border-border transition-colors disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <CurrentIcon className="w-4 h-4 text-foreground-muted" />
        <span className="flex-1 truncate text-foreground">{currentLabel}</span>
        <ChevronDown
          className={`w-4 h-4 text-foreground-muted transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-background-secondary border border-border rounded-lg shadow-lg z-dropdown overflow-hidden">
          <div className="py-1" role="listbox">
            {/* 個人モード */}
            <button
              onClick={() => handleSelect(null)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${
                isPersonalMode
                  ? 'bg-accent-subtle text-accent'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
              }`}
              role="option"
              aria-selected={isPersonalMode}
            >
              <User className="w-4 h-4" />
              <span className="flex-1">個人</span>
              {isPersonalMode && <Check className="w-4 h-4" />}
            </button>

            {/* 区切り線 */}
            {organizations.length > 0 && (
              <div className="my-1 border-t border-border" />
            )}

            {/* 組織一覧 */}
            {organizations.map(({ organization, role }) => {
              const isSelected = selectedOrganization?.organization.id === organization.id;
              return (
                <button
                  key={organization.id}
                  onClick={() => handleSelect(organization.id)}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${
                    isSelected
                      ? 'bg-accent-subtle text-accent'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-background-tertiary'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <Building2 className="w-4 h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{organization.name}</div>
                    <div className="text-xs text-foreground-muted">{role}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              );
            })}

            {/* 区切り線 */}
            <div className="my-1 border-t border-border" />

            {/* 組織を作成 */}
            <Link
              to="/organizations/new"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-tertiary transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>組織を作成</span>
            </Link>

            {/* 組織設定（組織選択時のみ） */}
            {selectedOrganization && (
              <Link
                to={`/organizations/${selectedOrganization.organization.id}/settings`}
                onClick={() => {
                  setIsOpen(false);
                  onClose?.();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-tertiary transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>組織設定</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
