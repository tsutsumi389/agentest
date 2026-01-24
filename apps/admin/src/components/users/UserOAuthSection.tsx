import { Github, Mail } from 'lucide-react';
import type { AdminUserOAuthProvider } from '@agentest/shared';

interface UserOAuthSectionProps {
  providers: AdminUserOAuthProvider[];
}

/**
 * プロバイダーアイコン
 */
function ProviderIcon({ provider }: { provider: string }) {
  switch (provider.toLowerCase()) {
    case 'github':
      return <Github className="w-5 h-5" />;
    case 'google':
      return <Mail className="w-5 h-5" />;
    default:
      return <Mail className="w-5 h-5" />;
  }
}

/**
 * プロバイダー名を表示用に変換
 */
function formatProviderName(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'github':
      return 'GitHub';
    case 'google':
      return 'Google';
    default:
      return provider;
  }
}

/**
 * 日付フォーマット
 */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * OAuth連携セクション
 */
export function UserOAuthSection({ providers }: UserOAuthSectionProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">
          OAuth連携（{providers.length}）
        </h2>
      </div>
      {providers.length === 0 ? (
        <div className="px-4 py-8 text-center text-foreground-muted">
          連携しているプロバイダーはありません
        </div>
      ) : (
        <div className="divide-y divide-border">
          {providers.map((provider, index) => (
            <div
              key={`${provider.provider}-${index}`}
              className="px-4 py-3 flex items-center justify-between hover:bg-background-tertiary"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center text-foreground-muted">
                  <ProviderIcon provider={provider.provider} />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {formatProviderName(provider.provider)}
                </span>
              </div>
              <span className="text-sm text-foreground-muted">
                {formatDate(provider.createdAt)}に連携
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
