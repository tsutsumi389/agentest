interface OrganizationPlanBadgeProps {
  plan: 'TEAM' | 'ENTERPRISE';
}

/**
 * 組織プランバッジ
 */
export function OrganizationPlanBadge({ plan }: OrganizationPlanBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded ${
        plan === 'ENTERPRISE'
          ? 'bg-accent-muted text-accent'
          : 'bg-background-tertiary text-foreground-muted'
      }`}
    >
      {plan}
    </span>
  );
}
