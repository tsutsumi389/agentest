import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { FlaskConical, Building2, User, Clock, CheckCircle, XCircle, AlertCircle, LogIn, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { organizationsApi, ApiError } from '../lib/api';
import type { InvitationDetail } from '../lib/api';

/**
 * 招待ページ共通レイアウト
 */
function InvitationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical className="w-10 h-10 text-accent" />
            <span className="text-2xl font-bold text-foreground">Agentest</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * 招待情報カード
 */
function InvitationInfoCard({ invitation, formatExpiresAt, getRoleLabel }: {
  invitation: InvitationDetail;
  formatExpiresAt: (expiresAt: string) => string;
  getRoleLabel: (role: string) => string;
}) {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg">
        <Building2 className="w-5 h-5 text-foreground-muted flex-shrink-0" />
        <div>
          <div className="text-xs text-foreground-subtle">組織</div>
          <div className="font-medium text-foreground">
            {invitation.organization.name}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg">
        <User className="w-5 h-5 text-foreground-muted flex-shrink-0" />
        <div>
          <div className="text-xs text-foreground-subtle">招待者</div>
          <div className="font-medium text-foreground">
            {invitation.invitedBy.name}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg">
        <Clock className="w-5 h-5 text-foreground-muted flex-shrink-0" />
        <div>
          <div className="text-xs text-foreground-subtle">有効期限</div>
          <div className="font-medium text-foreground">
            {formatExpiresAt(invitation.expiresAt)}
          </div>
        </div>
      </div>

      <div className="text-center">
        <span className="inline-block px-3 py-1 text-sm bg-accent/10 text-accent rounded-full">
          {getRoleLabel(invitation.role)}として招待されています
        </span>
      </div>
    </div>
  );
}

/**
 * 招待承諾ページ
 * 未認証ユーザーもアクセス可能だが、承諾/辞退には認証が必要
 */
export function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuthStore();

  const [invitation, setInvitation] = useState<InvitationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null);

  // 招待詳細を取得
  useEffect(() => {
    if (!token) {
      setError('招待トークンが見つかりません');
      setIsLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const response = await organizationsApi.getInvitationByToken(token);
        setInvitation(response.invitation);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === 'NOT_FOUND') {
            setError('招待が見つかりません。URLが正しいか確認してください。');
          } else {
            setError(err.message);
          }
        } else {
          setError('招待の取得に失敗しました');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  // 招待を承諾
  const handleAccept = async () => {
    if (!token) return;

    setIsProcessing(true);
    try {
      await organizationsApi.acceptInvitation(token);
      setResult('accepted');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('招待の承諾に失敗しました');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 招待を辞退
  const handleDecline = async () => {
    if (!token) return;

    setIsProcessing(true);
    try {
      await organizationsApi.declineInvitation(token);
      setResult('declined');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('招待の辞退に失敗しました');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    await logout();
  };

  // ダッシュボードに移動
  const goToDashboard = () => {
    navigate('/dashboard');
  };

  // ロール表示用のラベル
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'オーナー';
      case 'ADMIN':
        return '管理者';
      case 'MEMBER':
        return 'メンバー';
      default:
        return role;
    }
  };

  // 有効期限のフォーマット
  const formatExpiresAt = (expiresAt: string) => {
    const date = new Date(expiresAt);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ローディング中
  if (isLoading || authLoading) {
    return (
      <InvitationLayout>
        <div className="text-foreground-muted text-center">読み込み中...</div>
      </InvitationLayout>
    );
  }

  // エラー時
  if (error && !invitation) {
    return (
      <InvitationLayout>
        <div className="card p-6">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="w-12 h-12 text-danger mb-4" />
            <h1 className="text-lg font-semibold text-foreground mb-2">
              招待を読み込めませんでした
            </h1>
            <p className="text-foreground-muted mb-6">{error}</p>
            <Link to="/login" className="btn btn-primary">
              ログインページへ
            </Link>
          </div>
        </div>
      </InvitationLayout>
    );
  }

  // 招待が見つからない場合（念のため）
  if (!invitation) {
    return null;
  }

  // 承諾/辞退後の結果表示
  if (result) {
    return (
      <InvitationLayout>
        <div className="card p-6">
          <div className="flex flex-col items-center text-center">
            {result === 'accepted' ? (
              <>
                <CheckCircle className="w-12 h-12 text-success mb-4" />
                <h1 className="text-lg font-semibold text-foreground mb-2">
                  招待を承諾しました
                </h1>
                <p className="text-foreground-muted mb-6">
                  「{invitation.organization.name}」のメンバーになりました。
                </p>
                <button onClick={goToDashboard} className="btn btn-primary">
                  ダッシュボードへ
                </button>
              </>
            ) : (
              <>
                <XCircle className="w-12 h-12 text-foreground-muted mb-4" />
                <h1 className="text-lg font-semibold text-foreground mb-2">
                  招待を辞退しました
                </h1>
                <p className="text-foreground-muted mb-6">
                  「{invitation.organization.name}」への招待を辞退しました。
                </p>
                {isAuthenticated ? (
                  <button onClick={goToDashboard} className="btn btn-secondary">
                    ダッシュボードへ
                  </button>
                ) : (
                  <Link to="/login" className="btn btn-secondary">
                    ログインページへ
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </InvitationLayout>
    );
  }

  // 既に処理済みの招待
  if (invitation.status !== 'pending') {
    const statusMessages = {
      accepted: {
        icon: <CheckCircle className="w-12 h-12 text-success mb-4" />,
        title: 'この招待は既に承諾されています',
        message: 'この招待は既に使用されています。',
      },
      declined: {
        icon: <XCircle className="w-12 h-12 text-foreground-muted mb-4" />,
        title: 'この招待は既に辞退されています',
        message: 'この招待は既に辞退されています。',
      },
      expired: {
        icon: <Clock className="w-12 h-12 text-warning mb-4" />,
        title: 'この招待は期限切れです',
        message: '招待の有効期限が切れています。再度招待をリクエストしてください。',
      },
    };

    const statusInfo = statusMessages[invitation.status];

    return (
      <InvitationLayout>
        <div className="card p-6">
          <div className="flex flex-col items-center text-center">
            {statusInfo.icon}
            <h1 className="text-lg font-semibold text-foreground mb-2">
              {statusInfo.title}
            </h1>
            <p className="text-foreground-muted mb-6">{statusInfo.message}</p>
            {isAuthenticated ? (
              <button onClick={goToDashboard} className="btn btn-secondary">
                ダッシュボードへ
              </button>
            ) : (
              <Link to="/login" className="btn btn-primary">
                ログイン
              </Link>
            )}
          </div>
        </div>
      </InvitationLayout>
    );
  }

  // 未認証の場合：ログインを促す
  if (!isAuthenticated) {
    return (
      <InvitationLayout>
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-foreground text-center mb-6">
            組織への招待
          </h1>

          <InvitationInfoCard
            invitation={invitation}
            formatExpiresAt={formatExpiresAt}
            getRoleLabel={getRoleLabel}
          />

          {/* ログインを促すメッセージ */}
          <div className="border-t border-border pt-6">
            <div className="flex flex-col items-center text-center">
              <LogIn className="w-8 h-8 text-foreground-muted mb-3" />
              <p className="text-foreground-muted text-sm mb-4">
                招待を承諾するにはログインが必要です。
                <br />
                <span className="text-foreground font-medium">{invitation.email}</span>
                <br />
                のアカウントでログインしてください。
              </p>
              <Link
                to={`/login?redirect=/invitations/${token}`}
                className="btn btn-primary w-full"
              >
                ログイン
              </Link>
            </div>
          </div>
        </div>
      </InvitationLayout>
    );
  }

  // 認証済みだがメールアドレスが一致しない場合
  if (user && user.email !== invitation.email) {
    return (
      <InvitationLayout>
        <div className="card p-6">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="w-12 h-12 text-warning mb-4" />
            <h1 className="text-lg font-semibold text-foreground mb-2">
              別のアカウントでログインしてください
            </h1>
            <p className="text-foreground-muted mb-4">
              この招待は <span className="font-medium text-foreground">{invitation.email}</span> 宛てです。
            </p>
            <p className="text-foreground-muted mb-6">
              現在 <span className="font-medium text-foreground">{user.email}</span> でログインしています。
            </p>
            <div className="space-y-3 w-full">
              <button
                onClick={handleLogout}
                className="btn btn-primary w-full"
              >
                <LogOut className="w-4 h-4" />
                ログアウトして別アカウントでログイン
              </button>
              <button onClick={goToDashboard} className="btn btn-secondary w-full">
                ダッシュボードへ
              </button>
            </div>
          </div>
        </div>
      </InvitationLayout>
    );
  }

  // 認証済みで自分宛ての招待：承諾/辞退ボタンを表示
  return (
    <InvitationLayout>
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-foreground text-center mb-6">
          組織への招待
        </h1>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg mb-4">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <InvitationInfoCard
          invitation={invitation}
          formatExpiresAt={formatExpiresAt}
          getRoleLabel={getRoleLabel}
        />

        {/* アクションボタン */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="btn btn-primary w-full"
          >
            {isProcessing ? '処理中...' : '招待を承諾'}
          </button>
          <button
            onClick={handleDecline}
            disabled={isProcessing}
            className="btn btn-secondary w-full"
          >
            {isProcessing ? '処理中...' : '辞退する'}
          </button>
        </div>
      </div>
    </InvitationLayout>
  );
}
