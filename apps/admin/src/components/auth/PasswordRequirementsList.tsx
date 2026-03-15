import type { PasswordRequirements } from '@agentest/shared';

interface PasswordRequirementsListProps {
  requirements: PasswordRequirements;
}

const REQUIREMENT_ITEMS = [
  { key: 'minLength', label: '8文字以上' },
  { key: 'hasUppercase', label: '大文字を含む (A-Z)' },
  { key: 'hasLowercase', label: '小文字を含む (a-z)' },
  { key: 'hasNumber', label: '数字を含む (0-9)' },
  { key: 'hasSymbol', label: '記号を含む (!@#$%...)' },
] as const;

/**
 * パスワード要件チェックリスト
 * セットアップページ・招待受諾ページで共通利用
 */
export function PasswordRequirementsList({ requirements }: PasswordRequirementsListProps) {
  return (
    <div className="space-y-2 p-3 bg-surface-secondary rounded-md">
      <p className="text-xs font-medium text-foreground-muted mb-2">パスワード要件:</p>
      <ul className="space-y-1 text-xs">
        {REQUIREMENT_ITEMS.map(({ key, label }) => (
          <li
            key={key}
            className={`flex items-center gap-2 ${
              requirements[key] ? 'text-success' : 'text-foreground-subtle'
            }`}
          >
            <span>{requirements[key] ? '✓' : '○'}</span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
