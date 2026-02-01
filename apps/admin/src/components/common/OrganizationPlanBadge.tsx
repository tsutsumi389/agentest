interface OrganizationPlanBadgeProps {
  plan: 'NONE' | 'TEAM' | 'ENTERPRISE';
}

/**
 * 組織プランバッジ
 */
export function OrganizationPlanBadge({ plan }: OrganizationPlanBadgeProps) {
  const getClassName = () => {
    switch (plan) {
      case 'ENTERPRISE':
        return 'bg-accent-muted text-accent';
      case 'NONE':
        return 'bg-error-muted text-error';
      default:
        return 'bg-background-tertiary text-foreground-muted';
    }
  };

  const getLabel = () => {
    if (plan === 'NONE') {
      return '契約なし';
    }
    return plan;
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getClassName()}`}>
      {getLabel()}
    </span>
  );
}
