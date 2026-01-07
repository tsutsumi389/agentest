interface AgentestLogoProps {
  className?: string;
}

/**
 * Agentestの「A」ロゴコンポーネント
 * サイズはclassNameで制御可能
 */
export function AgentestLogo({ className }: AgentestLogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M16 4L4 28h5.5l2.5-5h8l2.5 5H28L16 4zm0 9l3 6h-6l3-6z"
        fill="currentColor"
      />
    </svg>
  );
}
