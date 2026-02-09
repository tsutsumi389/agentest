/**
 * パスワード強度チェックの条件
 */
export const PASSWORD_CHECKS = [
  { label: '8文字以上', test: (pw: string) => pw.length >= 8 },
  { label: '大文字を含む', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: '小文字を含む', test: (pw: string) => /[a-z]/.test(pw) },
  { label: '数字を含む', test: (pw: string) => /[0-9]/.test(pw) },
  { label: '記号を含む', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
] as const;

/**
 * パスワード強度チェックリスト
 */
export function PasswordStrengthChecklist({ password }: { password: string }) {
  return (
    <ul className="space-y-1 text-sm">
      {PASSWORD_CHECKS.map((check) => {
        const met = check.test(password);
        return (
          <li
            key={check.label}
            data-testid="password-check-item"
            data-met={met}
            className={`flex items-center gap-2 ${met ? 'text-success' : 'text-foreground-muted'}`}
          >
            <span className="text-xs">{met ? '✓' : '○'}</span>
            {check.label}
          </li>
        );
      })}
    </ul>
  );
}
