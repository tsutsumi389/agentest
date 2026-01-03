import { useSearchParams, Navigate } from 'react-router';
import { FlaskConical, Shield, AlertCircle, Check, X } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useState } from 'react';

/**
 * スコープの表示名マッピング
 */
const SCOPE_LABELS: Record<string, { label: string; description: string }> = {
  'mcp:read': {
    label: 'MCP読み取り',
    description: 'MCPツール経由でデータを読み取る権限',
  },
  'mcp:write': {
    label: 'MCP書き込み',
    description: 'MCPツール経由でデータを作成・更新・削除する権限',
  },
  'project:read': {
    label: 'プロジェクト読み取り',
    description: 'プロジェクト情報を閲覧する権限',
  },
  'project:write': {
    label: 'プロジェクト書き込み',
    description: 'プロジェクトを作成・更新する権限',
  },
  'test-suite:read': {
    label: 'テストスイート読み取り',
    description: 'テストスイートを閲覧する権限',
  },
  'test-suite:write': {
    label: 'テストスイート書き込み',
    description: 'テストスイートを作成・更新する権限',
  },
  'test-case:read': {
    label: 'テストケース読み取り',
    description: 'テストケースを閲覧する権限',
  },
  'test-case:write': {
    label: 'テストケース書き込み',
    description: 'テストケースを作成・更新する権限',
  },
  'execution:read': {
    label: '実行結果読み取り',
    description: 'テスト実行結果を閲覧する権限',
  },
  'execution:write': {
    label: '実行結果書き込み',
    description: 'テスト実行を作成・更新する権限',
  },
};

/**
 * OAuth 2.1 同意画面
 * クライアントアプリケーションへの権限付与を確認する
 */
export function OAuthConsentPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // URLパラメータから情報を取得
  const clientId = searchParams.get('client_id') || '';
  const clientName = searchParams.get('client_name') || 'Unknown Application';
  const scope = searchParams.get('scope') || '';
  const redirectUri = searchParams.get('redirect_uri') || '';
  const state = searchParams.get('state') || '';
  const codeChallenge = searchParams.get('code_challenge') || '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') || '';
  const resource = searchParams.get('resource') || '';

  // 未認証の場合はログインページへリダイレクト
  if (!isAuthenticated && !isLoading) {
    const currentUrl = window.location.href;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentUrl)}`} replace />;
  }

  // ローディング中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground-muted">読み込み中...</div>
      </div>
    );
  }

  // スコープをパース
  const scopes = scope.split(' ').filter(Boolean);

  const apiUrl = import.meta.env.VITE_API_URL || '';

  // 同意を送信
  const handleSubmit = async (approved: boolean) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/oauth/authorize/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          resource,
          approved,
        }),
      });

      const data = await response.json();

      // 成功時はredirect_urlにリダイレクト
      if (response.ok && data.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }

      // エラーの場合
      if (!response.ok) {
        console.error('Consent error:', data);
        // エラー時もリダイレクト
        const errorUrl = new URL(redirectUri);
        errorUrl.searchParams.set('error', data.error || 'server_error');
        errorUrl.searchParams.set('error_description', data.error_description || 'An error occurred');
        if (state) errorUrl.searchParams.set('state', state);
        window.location.href = errorUrl.toString();
      }
    } catch (error) {
      console.error('Consent submission error:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical className="w-10 h-10 text-accent" />
            <span className="text-2xl font-bold text-foreground">Agentest</span>
          </div>
        </div>

        {/* 同意カード */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-accent" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                アクセス許可の確認
              </h1>
              <p className="text-sm text-foreground-muted">
                {clientName} があなたのアカウントへのアクセスを求めています
              </p>
            </div>
          </div>

          {/* 警告 */}
          <div className="flex items-start gap-2 p-3 mb-6 bg-warning/10 border border-warning/20 rounded-md">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground-muted">
              このアプリケーションを信頼できる場合のみ許可してください。
              許可すると、以下の権限が付与されます。
            </p>
          </div>

          {/* スコープ一覧 */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-foreground mb-3">
              要求される権限:
            </h2>
            <ul className="space-y-2">
              {scopes.map((s) => {
                const info = SCOPE_LABELS[s] || { label: s, description: '' };
                return (
                  <li key={s} className="flex items-start gap-2 p-2 bg-surface-raised rounded">
                    <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {info.label}
                      </span>
                      {info.description && (
                        <p className="text-xs text-foreground-muted">
                          {info.description}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ボタン */}
          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="btn btn-secondary flex-1"
            >
              <X className="w-4 h-4" />
              拒否
            </button>
            <button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="btn btn-primary flex-1"
            >
              <Check className="w-4 h-4" />
              許可
            </button>
          </div>
        </div>

        {/* フッター */}
        <p className="text-xs text-foreground-subtle text-center mt-6">
          この許可はいつでも設定から取り消すことができます。
        </p>
      </div>
    </div>
  );
}
