interface PlanBadgeProps {
  plan: 'FREE' | 'PRO';
}

/**
 * プランバッジ
 */
export function PlanBadge({ plan }: PlanBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded ${
        plan === 'PRO'
          ? 'bg-accent-muted text-accent'
          : 'bg-background-tertiary text-foreground-muted'
      }`}
    >
      {plan}
    </span>
  );
}
